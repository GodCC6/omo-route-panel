import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { backgroundRoutes } from "../src/background.js";
import { backgroundSourceContracts, loadBackgroundEvidence } from "../src/background-evidence.js";
import type { NativeInspection, NativeReport, ConfigObject } from "../src/native/index.js";
import type { Json } from "../src/types.js";

const report: NativeReport = {
  categories: [
    { kind: "category", name: "quick", status: "resolved", primary: "fixture/fast", runtime: ["fixture/fast", "fixture/backup", "fixture/builtin"], rungs: [
      { model: "fixture/fast", source: "omo.json", state: "primary" },
      { model: "fixture/backup", source: "omo.json", state: "fallback" },
      { model: "fixture/builtin", source: "built-in", state: "fallback" },
    ] },
    { kind: "category", name: "custom", status: "resolved", primary: "fixture/custom", runtime: ["fixture/custom"], rungs: [{ model: "fixture/custom", source: "omo.json", state: "primary" }] },
  ], agents: [], excludeModels: [], modelProfile: {},
};
// Synthetic mapping coverage, not upstream semantic verification.
const runtimeRoot = await mkdtemp(join(tmpdir(), "background-mapping-"));
after(() => rm(runtimeRoot, { recursive: true, force: true }));
await mkdir(join(runtimeRoot, "plugin", "extensions"), { recursive: true });
await writeFile(join(runtimeRoot, "plugin", "extensions", "omo.js"), Object.values(backgroundSourceContracts).flatMap((contract) => contract.fragments).join("\n"));
const evidence = await loadBackgroundEvidence(runtimeRoot);
function inspection(configs: readonly ConfigObject[], profile?: string): NativeInspection {
  return {
    home: "/fixture", project: "/fixture/project", ...(profile ? { profile } : {}),
    engine: { version: "fixture", moduleDigest: "", runtimeRoot, nodePath: "", nodeVersion: "", nodeSourcePath: "", launcherPath: "", launcherSourcePath: "", launcherDigest: "" },
    files: configs.map((config, index) => ({ config, path: `/fixture/${index}`, sourceId: String(index), relativePath: String(index), scope: index === 0 ? "user" : "project", revision: "" })),
    watchPaths: [], settings: { globalPath: "", projectPath: "", projectInfluence: "unknown", pathStatus: "verified-global" },
  };
}
const quick = { quick: { models: ["fixture/fast", "fixture/backup"] } };
function rows(configs: readonly ConfigObject[], profile?: string, fields: Readonly<Record<string, Json>> = {}) {
  return backgroundRoutes(inspection(configs, profile), report, fields, evidence);
}

test("user scope excludes automatic project identity overrides rather than deriving a HOME identity", () => {
  // Given: this same identity override demonstrably applies in project scope.
  const identity = `fixture-${createHash("sha256").update("/fixture").digest("hex").slice(0, 8)}`;
  const context = { ...inspection([{ memory: {
    facts: { enabled: true, model: "fixture/global" },
    agents: { [identity]: { facts: { enabled: false, model: "fixture/identity" } } },
  } }]), project: "/fixture" };
  const project = backgroundRoutes(context, report, {}, evidence, "project").find((row) => row.id === "facts");
  assert.equal(project?.enabled, false);
  assert.equal(project?.model, "fixture/identity");
  // When
  const user = backgroundRoutes(context, report, {}, evidence, "user").find((row) => row.id === "facts");
  // Then
  assert.equal(user?.enabled, true);
  assert.equal(user?.model, "fixture/global");
});

test("omitted memory switches resolve to enabled defaults without pretending to have a session model", () => {
  // Given / When
  const result = rows([{}]);
  // Then
  for (const id of ["recall", "reflection", "dream", "facts", "nudge", "sync"]) assert.equal(result.find((row) => row.id === id)?.enabled, true, id);
  assert.equal(result.find((row) => row.id === "facts")?.modelStrategy, "session");
  assert.equal(result.find((row) => row.id === "dream")?.modelStrategy, "dynamic");
  assert.equal(result.find((row) => row.id === "dream")?.category, "quick");
  assert.equal(result.find((row) => row.id === "dream")?.model, null);
});

test("facts uses only explicit quick candidates and excludes appended built-in fallbacks", () => {
  // Given / When
  const facts = rows([{ categories: quick }]).find((row) => row.id === "facts");
  // Then
  assert.equal(facts?.modelStrategy, "category");
  assert.equal(facts?.category, "quick");
  assert.deepEqual(facts?.candidates.map((entry) => entry.model), ["fixture/fast", "fixture/backup"]);
});

test("facts explicit model wins over quick and preserves a provider-like ID segment", () => {
  // Given / When
  const facts = rows([{ categories: quick, "[native]": { memory: { facts: { model: "fixture/fixture/nested" } } } }]).find((row) => row.id === "facts");
  // Then
  assert.equal(facts?.model, "fixture/fixture/nested");
  assert.equal(facts?.category, null);
  assert.equal(facts?.modelStrategy, "fixed");
});

test("binding provenance is separate from the effective switch and respects identity scope", () => {
  // Given: the global switch shadows the task switch, but not its binding source.
  const identity = `project-${createHash("sha256").update("/fixture/project").digest("hex").slice(0, 8)}`;
  const config = { memory: { enabled: false, facts: { model: "fixture/user" },
    agents: { [identity]: { facts: { model: "fixture/identity" } } } } };
  const context = inspection([config]);
  // When
  const project = backgroundRoutes(context, report, {}, evidence, "project").find((row) => row.id === "facts");
  const user = backgroundRoutes(context, report, {}, evidence, "user").find((row) => row.id === "facts");
  // Then
  assert.equal(project?.enabled, false);
  assert.equal(project?.model, "fixture/identity");
  assert.match(project?.bindingSource ?? "", /Identity override/);
  assert.equal(user?.model, "fixture/user");
  assert.match(user?.bindingSource ?? "", /User override/);
  assert.doesNotMatch(user?.bindingSource ?? "", /Identity override/);
});

test("binding provenance follows harness and active-profile precedence rather than the last file", () => {
  // Given
  const configured = rows([
    { "[native]": { memory: { recall: { category: "custom" } } },
      profiles: { focus: { "[native]": { memory: { reflection: { category: "custom" } } } } } },
    { memory: { recall: { category: "quick" }, reflection: { category: "quick" } } },
  ], "focus");
  // Then
  assert.equal(configured.find((row) => row.id === "recall")?.category, "custom");
  assert.match(configured.find((row) => row.id === "recall")?.bindingSource ?? "", /User override/);
  assert.match(configured.find((row) => row.id === "reflection")?.bindingSource ?? "", /User override in active profile/);
  assert.match(configured.find((row) => row.id === "dream")?.bindingSource ?? "", /Shared Reflection category; User override in active profile/);
  const inherited = rows([{}]).find((row) => row.id === "recall");
  assert.match(inherited?.bindingSource ?? "", /OMO built-in default/);
});

test("file layers merge before harness and profile layers for memory settings", () => {
  // Given
  const result = rows([
    { memory: { facts: { enabled: false } }, "[native]": { memory: { facts: { enabled: true } } },
      profiles: { focus: { memory: { dream: { enabled: false } }, "[native]": { memory: { reflection: { category: "custom" } } } } } },
    { memory: { facts: { enabled: false } }, "[native]": { memory: { sync: { enabled: false } } } },
  ], "focus");
  // Then
  assert.equal(result.find((row) => row.id === "facts")?.enabled, true);
  assert.equal(result.find((row) => row.id === "dream")?.enabled, false);
  assert.equal(result.find((row) => row.id === "sync")?.enabled, false);
  assert.equal(result.find((row) => row.id === "dream")?.category, "custom");
  assert.deepEqual(result.find((row) => row.id === "dream")?.candidates, [{ model: "fixture/custom" }]);
});

test("the memory master switch disables all memory tasks even when their switches are true", () => {
  // Given / When
  const result = rows([{ "[native]": { memory: { enabled: false, dream: { enabled: true }, recall: { enabled: true } } } }]);
  // Then
  for (const id of ["dream", "recall", "reflection", "facts", "nudge", "sync"]) assert.equal(result.find((row) => row.id === id)?.enabled, false);
  assert.equal(result.find((row) => row.id === "compaction")?.enabled, null);
});

test("identity overrides win over global model and switch values", () => {
  // Given: sha256('writer').slice(0, 8) is b9300677.
  const memory = { agent: "writer", facts: { model: "fixture/global", enabled: true }, agents: { "writer-b9300677": { facts: { model: "fixture/identity", enabled: false } } } };
  // When
  const facts = rows([{ memory }]).find((row) => row.id === "facts");
  // Then
  assert.equal(facts?.enabled, false);
  assert.equal(facts?.model, "fixture/identity");
});

for (const globalEnabled of [false, true]) {
  test(`identity master and sync switches cannot reverse global ${globalEnabled} gates`, () => {
    // Given
    const memory = {
      agent: "writer", enabled: globalEnabled, sync: { enabled: globalEnabled },
      agents: { "writer-b9300677": { enabled: !globalEnabled, sync: { enabled: !globalEnabled } } },
    };
    // When
    const result = rows([{ memory }]);
    // Then
    for (const id of ["recall", "reflection", "dream", "facts", "nudge", "sync"]) {
      assert.equal(result.find((row) => row.id === id)?.enabled, globalEnabled, id);
    }
  });
  test(`identity sync overrides cannot reverse the global sync ${globalEnabled} switch`, () => {
    // Given / When
    const result = rows([{ memory: {
      agent: "writer", sync: { enabled: globalEnabled },
      agents: { "writer-b9300677": { sync: { enabled: !globalEnabled } } },
    } }]);
    // Then
    assert.equal(result.find((row) => row.id === "sync")?.enabled, globalEnabled);
    assert.equal(result.find((row) => row.id === "facts")?.enabled, true);
  });
}

test("unverified git identities with overrides do not claim an effective switch or model", () => {
  // Given / When
  const result = rows([{ memory: { auto_identity: "git", agents: { other: { facts: { enabled: false } } } } }]);
  // Then
  assert.equal(result.find((row) => row.id === "facts")?.enabled, null);
  assert.equal(result.find((row) => row.id === "facts")?.modelStrategy, "unknown");
});

test("native candidate resolution and source-verified switches are independent", () => {
  // Given / When
  const result = backgroundRoutes(inspection([{}]), null, {}, evidence);
  // Then
  assert.equal(result.find((row) => row.id === "dream")?.enabled, true);
  assert.deepEqual(result.find((row) => row.id === "recall")?.candidates, []);
});

test("compaction remains independent of the memory master switch", () => {
  // Given / When
  const compaction = rows([{ memory: { enabled: false } }], undefined, { "settings:compaction.model": "fixture/summary" }).find((row) => row.id === "compaction");
  // Then
  assert.equal(compaction?.model, "fixture/summary");
  assert.equal(compaction?.modelStrategy, "fixed");
});

test("a valid native report cannot substitute for missing semantic evidence", () => {
  // Given / When
  const result = backgroundRoutes(inspection([{}]), report, { "settings:compaction.model": "fixture/summary" });
  // Then
  for (const id of ["recall", "reflection", "dream", "facts", "nudge", "sync"]) {
    const row = result.find((entry) => entry.id === id);
    assert.equal(row?.enabled, null, id);
    if (!["nudge", "sync"].includes(id)) assert.equal(row?.modelStrategy, "unknown", id);
  }
  assert.equal(result.find((row) => row.id === "compaction")?.model, "fixture/summary");
});

test("missing Facts precedence evidence invalidates only its dependent model fields", () => {
  // Given
  const missing = { ...evidence, rules: { ...evidence.rules, factsQuick: { ...evidence.rules.factsQuick, status: "unknown" as const, reason: "Facts quick contract changed." } } };
  // When
  const result = backgroundRoutes(inspection([{ categories: quick }]), report, {}, missing);
  // Then
  const facts = result.find((row) => row.id === "facts");
  assert.equal(facts?.enabled, true);
  assert.equal(facts?.modelStrategy, "unknown");
  assert.deepEqual(facts?.candidates, []);
  assert.ok(facts?.semanticEvidence?.reasons.includes("Facts quick contract changed."));
  assert.equal(result.find((row) => row.id === "dream")?.modelStrategy, "dynamic");
  const explicit = backgroundRoutes(inspection([{ memory: { facts: { model: "fixture/chosen" } } }]), report, {}, missing);
  assert.equal(explicit.find((row) => row.id === "facts")?.model, "fixture/chosen");
});

test("missing dynamic selection evidence preserves the independently verified category chain", () => {
  // Given
  const missing = { ...evidence, rules: { ...evidence.rules, reflectionDynamic: { ...evidence.rules.reflectionDynamic, status: "unknown" as const, reason: "Dynamic selection is unverified." } } };
  // When
  const result = backgroundRoutes(inspection([{ memory: { reflection: { category: "custom" } } }]), report, {}, missing);
  // Then
  for (const id of ["reflection", "dream"]) {
    const row = result.find((entry) => entry.id === id);
    assert.equal(row?.enabled, true);
    assert.equal(row?.category, "custom");
    assert.equal(row?.modelStrategy, "unknown");
    assert.deepEqual(row?.candidates, [{ model: "fixture/custom" }]);
  }
});

test("missing default evidence preserves explicit switches and a proved false global gate", () => {
  // Given
  const missing = { ...evidence, rules: { ...evidence.rules, defaults: { ...evidence.rules.defaults, status: "unknown" as const, reason: "Defaults are unverified." } } };
  // When
  const explicit = backgroundRoutes(inspection([{ memory: { enabled: true, facts: { enabled: false } } }]), report, {}, missing);
  const disabled = backgroundRoutes(inspection([{ memory: { enabled: false, auto_identity: "git", agents: { other: {} } } }]), report, {}, missing);
  // Then
  assert.equal(explicit.find((row) => row.id === "facts")?.enabled, false);
  assert.equal(explicit.find((row) => row.id === "dream")?.enabled, null);
  for (const id of ["recall", "reflection", "dream", "facts", "nudge", "sync"]) assert.equal(disabled.find((row) => row.id === id)?.enabled, false);
});

test("user quick filtering retains native order but rejects non-user candidates", () => {
  // Given
  const config = { categories: { quick: { model: "fixture/backup", fallback_models: ["fixture/fast"] } } };
  // When
  const facts = rows([config]).find((row) => row.id === "facts");
  const disabled = rows([{ categories: { quick: { ...quick.quick, disable: true } } }]).find((row) => row.id === "facts");
  // Then
  assert.deepEqual(facts?.candidates, [{ model: "fixture/fast" }, { model: "fixture/backup" }]);
  assert.deepEqual(disabled?.candidates, []);
});

test("evidence from another installation cannot validate memory semantics", () => {
  // Given / When
  const result = backgroundRoutes(inspection([{}]), report, {}, { ...evidence, runtimeRoot: "/another/runtime" });
  // Then
  assert.equal(result.find((row) => row.id === "facts")?.enabled, null);
  assert.equal(result.find((row) => row.id === "dream")?.modelStrategy, "unknown");
});

test("artifact changes erase dependent memory fields without erasing unrelated settings or reports", async () => {
  // Given
  const before = rows([{ categories: quick }]);
  assert.equal(before.find((row) => row.id === "facts")?.enabled, true);
  assert.equal(before.find((row) => row.id === "facts")?.modelStrategy, "category");
  // When: same native report and routing configuration, different artifact bytes.
  await writeFile(join(runtimeRoot, "plugin", "extensions", "omo.js"), "// changed artifact");
  const changed = await loadBackgroundEvidence(runtimeRoot);
  const result = backgroundRoutes(inspection([{ categories: quick }]), report, { "settings:compaction.model": "fixture/summary" }, changed);
  // Then
  for (const id of ["recall", "reflection", "dream", "facts", "nudge", "sync"]) assert.equal(result.find((row) => row.id === id)?.enabled, null, id);
  assert.equal(result.find((row) => row.id === "facts")?.modelStrategy, "unknown");
  assert.deepEqual(result.find((row) => row.id === "facts")?.candidates, []);
  assert.equal(result.find((row) => row.id === "compaction")?.model, "fixture/summary");
  assert.deepEqual(report.categories.find((route) => route.name === "custom")?.runtime, ["fixture/custom"]);
});
