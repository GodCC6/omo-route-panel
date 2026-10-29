import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { backgroundEvidencePaths, backgroundSourceContracts, loadBackgroundEvidence } from "../src/background-evidence.js";
import { backgroundRoutes } from "../src/background.js";
import type { NativeReport } from "../src/native/index.js";

const syntheticSource = Object.values(backgroundSourceContracts).flatMap((contract) => contract.fragments).join("\n");

// Independently recorded from the installed 5.1.51 schema and its default parser.
const installedDefaults = [
  'hu=kd({enabled:pd().default(!0),agent:Dl().min(1).default("auto"),auto_identity:pu.default("path"),reflection:zc.default({enabled:!0,trigger:{step_count:25,on_compaction:!0},merge:"auto",category:"quick",timeout_minutes:15,max_concurrent_runs:1,sandbox:"auto"}),nudge:Gc.default({enabled:!0,every_user_turns:10}),facts:Kc.default({enabled:!0,debounce_settles:4}),dream:Yc.default({enabled:!0,idle_minutes:30,min_hours_between:24,shutdown_launch:!0,auto_select_max:5,auto_select_max_chars:15e4})',
  'sync:Fc.default({enabled:!0}),search:Uc.default({enabled:!0}),recall:Wc.default({enabled:!0,max_items:2,category:"quick"',
  'function b0(e){return e??hu.parse({})}',
].join("\n");

test("installed defaults retain semantic and parser binding checks", async (t) => {
  for (const [source, expected] of [
    [installedDefaults, "verified"],
    [installedDefaults.replace("enabled:pd().default(!0)", "enabled:pd().default(!1)"), "unknown"],
    [installedDefaults.replace('category:"quick"', 'category:"other"'), "unknown"],
    [installedDefaults.replace("return e??hu.parse({})", "return e??fu.parse({})"), "unknown"],
    [`${installedDefaults}\nfunction b0(e){return e??hu.parse({})}`, "unknown"],
  ] as const) {
    // Given
    const root = await mkdtemp(join(tmpdir(), "background-defaults-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(join(root, "plugin", "extensions"), { recursive: true });
    await writeFile(join(root, "plugin", "extensions", "omo.js"), source);
    // When
    const evidence = await loadBackgroundEvidence(root);
    // Then
    assert.equal(evidence.rules.defaults.status, expected);
    assert.equal(evidence.rules.globalGate.status, "unknown");
  }
});

test("synthetic source contracts record artifact identity, references and field dependencies", async (t) => {
  // Given
  const root = await mkdtemp(join(tmpdir(), "background-evidence-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "plugin", "extensions", "omo.js");
  await mkdir(join(root, "plugin", "extensions"), { recursive: true });
  await writeFile(path, syntheticSource);
  // When
  const evidence = await loadBackgroundEvidence(root);
  // Then
  assert.deepEqual(backgroundEvidencePaths(root), [path]);
  assert.equal(evidence.artifacts[0]?.digest, createHash("sha256").update(syntheticSource).digest("hex"));
  for (const rule of Object.values(evidence.rules)) {
    assert.equal(rule.status, "verified");
    assert.equal(rule.method, "recorded-source-contract");
    assert.ok(rule.affectedFields.length > 0);
    assert.ok(rule.references.length > 0);
    for (const reference of rule.references) {
      assert.equal(reference.path, path);
      const fragment = syntheticSource.slice(reference.offset, reference.offset + reference.length);
      assert.equal(reference.digest, createHash("sha256").update(fragment).digest("hex"));
    }
  }
});

test("changing a semantic artifact invalidates evidence without changing the native report", async (t) => {
  // Given
  const root = await mkdtemp(join(tmpdir(), "background-change-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "plugin", "extensions", "omo.js");
  await mkdir(join(root, "plugin", "extensions"), { recursive: true });
  await writeFile(path, syntheticSource);
  const before = await loadBackgroundEvidence(root);
  const report: NativeReport = { categories: [{ kind: "category", name: "custom", status: "resolved", primary: "fixture/route", runtime: ["fixture/route"], rungs: [] }], agents: [], excludeModels: [], modelProfile: {} };
  // When
  await writeFile(path, `${syntheticSource}\n// changed implementation artifact`);
  const after = await loadBackgroundEvidence(root);
  // Then
  assert.notEqual(before.artifacts[0]?.digest, after.artifacts[0]?.digest);
  assert.ok(Object.values(after.rules).every((rule) => rule.status === "unknown" && rule.reason.includes("changed")));
  assert.equal(report.categories[0]?.runtime[0], "fixture/route");
  const compaction = backgroundRoutes(null, report, { "settings:compaction.model": "fixture/summary" }, after).find((row) => row.id === "compaction");
  assert.equal(compaction?.model, "fixture/summary");
});

test("a missing or ambiguous rule invalidates only that rule on initial inspection", async (t) => {
  for (const source of [
    syntheticSource.replace(backgroundSourceContracts.factsModel.fragments[0], "// no Facts precedence evidence"),
    `${syntheticSource}\n${backgroundSourceContracts.factsModel.fragments[0]}`,
  ]) {
    // Given
    const root = await mkdtemp(join(tmpdir(), "background-contract-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const path = join(root, "plugin", "extensions", "omo.js");
    await mkdir(join(root, "plugin", "extensions"), { recursive: true });
    await writeFile(path, source);
    // When
    const evidence = await loadBackgroundEvidence(root);
    // Then
    assert.equal(evidence.rules.factsModel.status, "unknown");
    assert.equal(evidence.rules.syncGlobal.status, "verified");
    assert.equal(evidence.rules.dreamReflection.status, "verified");
  }
});

test("missing artifacts are unknown rather than a disabled task", async (t) => {
  // Given
  const root = await mkdtemp(join(tmpdir(), "background-missing-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  // When
  const evidence = await loadBackgroundEvidence(root);
  // Then
  assert.deepEqual(evidence.artifacts, []);
  assert.ok(Object.values(evidence.rules).every((rule) => rule.status === "unknown" && rule.references.length === 0));
});

test("source inspection does not follow implementation symlinks outside the runtime", async (t) => {
  // Given
  const root = await mkdtemp(join(tmpdir(), "background-symlink-"));
  const outside = await mkdtemp(join(tmpdir(), "background-outside-"));
  t.after(() => Promise.all([rm(root, { recursive: true, force: true }), rm(outside, { recursive: true, force: true })]));
  const target = join(outside, "untrusted.js");
  await writeFile(target, 'throw new Error("Source inspection must not execute this artifact");');
  await mkdir(join(root, "plugin", "extensions"), { recursive: true });
  await symlink(target, join(root, "plugin", "extensions", "omo.js"));
  // When
  const evidence = await loadBackgroundEvidence(root);
  // Then
  assert.deepEqual(evidence.artifacts, []);
  assert.ok(Object.values(evidence.rules).every((rule) => rule.reason.includes("outside")));
});
