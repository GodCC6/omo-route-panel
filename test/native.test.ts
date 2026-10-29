import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdir, writeFile, symlink, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAdapter } from "../src/native/index.js";
import { discover, projectConfig } from "../src/native/config.js";
import { runProcess } from "../src/native/process.js";
import { fixture, futureRuntime, models, syntheticCatalogAdapter } from "./native-fixture.js";
import { catalogSnapshot } from "../src/native/catalog.js";
import { NativeError } from "../src/native/config.js";

const node = process.execPath;

test("production catalog and resolution require an explicitly injected host", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await futureRuntime(f.home, "unbound-catalog");
  const adapter = createNativeAdapter({ home: f.home, launcherPath: join(root, "omo") });
  await mkdir(join(f.home, ".omo", "agent"), { recursive: true });
  // When
  const result = await adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "host-required" });
  assert.deepEqual(await adapter.catalog({ project: f.project }), { status: "unsupported", code: "host-required" });
});

test("an injected HOME owns the default launcher and installation discovery", async (t) => {
  // Given a complete synthetic installation under the injected HOME.
  const f = await fixture(t);
  const launcher = join(f.home, ".local", "bin", "omo");
  await mkdir(join(f.home, ".local", "bin"), { recursive: true });
  await symlink(f.launcherPath, launcher);
  // When no launcher or runtime path is explicitly supplied.
  const result = await createNativeAdapter({ home: f.home }).inspect({ project: f.project });
  // Then discovery uses only the injected installation.
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status === "ok") {
    assert.equal(result.value.engine.launcherSourcePath, launcher);
    assert.equal(result.value.engine.version, "synthetic-contract");
  }
});

test("a model list from a different executable cannot authorize native resolution", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await futureRuntime(f.home, "source-catalog");
  const adapter = createNativeAdapter({
    home: f.home, launcherPath: join(root, "omo"),
    host: {
      catalog: async () => models,
      verify: async () => { throw new NativeError("host-installation-changed"); },
    },
  });
  // When
  const result = await adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "host-installation-changed" });
});

test("host model changes invalidate a catalog before either native report can accept it", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await futureRuntime(f.home, "input-catalog");
  const adapter = syntheticCatalogAdapter({ home: f.home, launcherPath: join(root, "omo") }, catalogSnapshot([]));
  // When
  const result = await adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "host-catalog-changed" });
});

test("tampered model lists cannot retain a host catalog revision", async (t) => {
  // Given
  const f = await fixture(t);
  assert.equal(models.status, "ok");
  if (models.status !== "ok") return;
  // When
  const result = await f.adapter.resolve({
    project: f.project, catalog: { ...models, models: [{ provider: "foreign", id: "not-in-host" }] },
  });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "catalog-revision" });
});

test("user-only reports do not depend on the host current-project configuration", async (t) => {
  // Given
  const f = await fixture(t);
  await f.config(f.home, {});
  const path = await f.config(f.project, {});
  await writeFile(path, "{ invalid");
  // When
  const user = await f.adapter.resolve({ project: f.home, catalog: models });
  const project = await f.adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.equal(user.status, "ok", JSON.stringify(user));
  assert.deepEqual(project, { status: "unsupported", code: "config-parse" });
  if (user.status === "ok") assert.ok(user.value.inspection.files.every((file) => file.scope === "user"));
});

test("host-only catalog lookup respects cancellation before and during a lookup", async (t) => {
  // Given
  const f = await fixture(t);
  const abort = new AbortController();
  let calls = 0;
  const adapter = createNativeAdapter({
    home: f.home, launcherPath: f.launcherPath, signal: abort.signal,
    host: {
      catalog: async () => { calls++; abort.abort(); return models; },
      verify: async () => {},
    },
  });
  // When / Then
  assert.deepEqual(await adapter.catalog({ project: f.home }), { status: "unsupported", code: "process-aborted" });
  assert.deepEqual(await adapter.catalog({ project: f.home }), { status: "unsupported", code: "process-aborted" });
  assert.equal(calls, 1);
});

test("host injection retains real and mirror report equivalence checks", async (t) => {
  // Given
  const f = await fixture(t);
  await writeFile(join(f.home, "synthetic-contract", "plugin/runtime/category-coverage/index.js"), `
    export function modelChains({env}) { return {categories:[],agents:[],excludeModels:[],modelProfile:{home:env.HOME}}; }
    export function configDoctorLines() { return []; }
  `);
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "mirror-mismatch" });
});

test("host injection cannot grant native report workers filesystem writes", async (t) => {
  // Given
  const f = await fixture(t);
  await writeFile(join(f.home, "synthetic-contract", "plugin/runtime/category-coverage/index.js"), `
    import {writeFileSync} from "node:fs";
    export function modelChains() { writeFileSync("forbidden-write", "SYNTHETIC_PRIVATE"); }
    export function configDoctorLines() { return []; }
  `);
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "report-permission" });
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_PRIVATE/);
});

test("native discovers jsonc precedence without copying unrelated settings", async (t) => {
  // Given
  const f = await fixture(t);
  await f.config(f.home, { categories: { custom: { models: ["fixture/two"], prompt_append: "private prompt" } }, mcp: { private: true } });
  await f.config(f.home, { categories: { custom: { models: ["fixture/one"] } } }, "omo.json");
  // When
  const result = discover(f.home, f.project);
  // Then
  assert.equal(result.files.length, 1);
  assert.deepEqual(result.files[0]?.config, { categories: { custom: { models: ["fixture/two"] } } });
  assert.ok(result.files[0]?.path.endsWith(".jsonc"));
});

test("native refuses a symlinked project configuration", async (t) => {
  // Given
  const f = await fixture(t);
  const outside = join(f.home, "elsewhere");
  await mkdir(outside);
  await symlink(outside, join(f.project, ".omo"));
  // When
  const result = await f.adapter.inspect({ project: f.project });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "symlink-context" });
});

test("native refuses malformed JSONC before importing report", async (t) => {
  // Given
  const f = await fixture(t);
  const path = await f.config(f.home, {});
  await writeFile(path, "{ invalid");
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "config-parse" });
});

test("an unlisted future OMO version works when its actual contract is compatible", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await futureRuntime(f.home, "future-not-in-any-version-list");
  // When
  const result = await syntheticCatalogAdapter({ home: f.home, launcherPath: join(root, "omo") }).resolve({ project: f.project, catalog: models });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status === "ok") assert.equal(result.value.inspection.engine.version, "future-not-in-any-version-list");
});

test("a future OMO version with a malformed report still fails closed", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await futureRuntime(f.home, "future-malformed", true);
  // When
  const result = await syntheticCatalogAdapter({ home: f.home, launcherPath: join(root, "omo") }).resolve({ project: f.project, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "report-shape" });
});

test("an existing adapter follows a launcher upgrade without restarting", async (t) => {
  // Given
  const f = await fixture(t);
  const before = await futureRuntime(f.home, "before-update");
  const after = await futureRuntime(f.home, "after-update");
  const launcher = join(f.home, "active-omo");
  await symlink(join(before, "omo"), launcher);
  const adapter = createNativeAdapter({ home: f.home, launcherPath: launcher });
  assert.equal((await adapter.inspect({ project: f.project })).status, "ok");
  await symlink(join(after, "omo"), `${launcher}.next`);
  // When
  await rename(`${launcher}.next`, launcher);
  const result = await adapter.inspect({ project: f.project });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status === "ok") assert.equal(result.value.engine.version, "after-update");
});

test("native catalog failure is unknown and does not produce empty routes", async (t) => {
  // Given
  const f = await fixture(t);
  const catalog = { status: "unknown", code: "synthetic-catalog-failure" } as const;
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog });
  // Then
  assert.deepEqual(catalog, { status: "unknown", code: "synthetic-catalog-failure" });
  assert.deepEqual(result, { status: "unknown", code: "catalog-unknown" });
});

test("permission process refuses writes network and subprocesses", async (t) => {
  // Given
  const f = await fixture(t);
  const script = `
    const fs = await import("node:fs"); const cp = await import("node:child_process"); const net = await import("node:net");
    let denied = 0;
    try { fs.writeFileSync("not-created", "x"); } catch (e) { if(e.code==="ERR_ACCESS_DENIED") denied++; }
    try { cp.spawnSync("true"); } catch (e) { if(e.code==="ERR_ACCESS_DENIED") denied++; }
    await new Promise((resolve,reject) => {
      try { const socket = net.connect({port:9,host:"127.0.0.1"}); socket.on("error",e => {
        if(e.code==="ERR_ACCESS_DENIED") { denied++; resolve(); } else reject(e);
      }); } catch (e) { if(e.code==="ERR_ACCESS_DENIED") { denied++; resolve(); } else reject(e); }
    });
    console.log(denied);
  `;
  // When
  const result = await runProcess({ executable: node, args: ["--permission", "--input-type=module", "-e", script], cwd: f.home, env: {}, input: "", timeoutMs: 5000 });
  // Then
  assert.equal(result.trim(), "3");
});

test("native refuses candidate fields outside routing projection", async (t) => {
  // Given
  const f = await fixture(t);
  await f.config(f.home, {});
  const found = discover(f.home, f.project);
  const source = found.files[0];
  assert.ok(source);
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog: models, candidate: { [source.sourceId]: { mcp: {} } } });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "candidate-fields" });
});

test("native profile projection strips credential-shaped unrelated root blocks", () => {
  // Given / When
  const config = projectConfig({
    "[native]": { categories: { custom: { models: ["fixture/one"] } }, provider: { credential: "synthetic" } },
    profiles: { focus: { mcp: {}, agents: { helper: { models: ["fixture/one"] } } } },
    auth: { token: "synthetic" }, packages: ["private-package"],
  });
  // Then
  assert.deepEqual(config, {
    "[native]": { categories: { custom: { models: ["fixture/one"] } } },
    profiles: { focus: { agents: { helper: { models: ["fixture/one"] } } } },
  });
});

test("memory projection preserves switches identity overrides and dream triggers but strips unrelated fields", () => {
  // Given / When
  const projected = projectConfig({ memory: {
    enabled: false, agent: "writer", auto_identity: "path",
    dream: { enabled: true, shutdown_launch: false, idle_minutes: 12, min_hours_between: 3, prompt: "synthetic private text" },
    agents: { writer: { facts: { model: "fixture/one" }, sync: { enabled: false, remote: "synthetic private URL" } } },
    private: "synthetic",
  } });
  // Then
  assert.deepEqual(projected, { memory: {
    enabled: false, agent: "writer", auto_identity: "path",
    dream: { enabled: true, shutdown_launch: false, idle_minutes: 12, min_hours_between: 3 },
    agents: { writer: { facts: { model: "fixture/one" }, sync: { enabled: false } } },
  } });
});

test("native discovers a host project beyond HOME without unbounded ancestor traversal", async (t) => {
  // Given
  const f = await fixture(t);
  // When
  const result = await f.adapter.inspect({ project: tmpdir() });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status === "ok") assert.equal(result.value.project, await import("node:fs/promises").then((fs) => fs.realpath(tmpdir())));
});

test("native projection rejects unknown embedded chain fields", () => {
  // Given / When
  const projected = projectConfig({ categories: { custom: { models: [{ model: "fixture/one", reasoning: "high", headers: { secret: "synthetic" } }] } } });
  // Then
  assert.deepEqual(projected, { categories: { custom: { models: [{ model: "fixture/one", reasoning: "high" }] } } });
});

test("native rejects upgraded launcher while approved old runtime remains", async (t) => {
  // Given
  const f = await fixture(t);
  const launcher = join(f.home, "upgraded-launcher");
  await writeFile(launcher, "synthetic future executable");
  // When
  const result = await createNativeAdapter({ home: f.home, launcherPath: launcher }).inspect({ project: f.project });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "engine-launcher-mismatch" });
});

test("native refuses a dangling configuration symlink", async (t) => {
  // Given
  const f = await fixture(t);
  await mkdir(join(f.home, ".omo"));
  await symlink(join(f.home, "missing"), join(f.home, ".omo", "omo.jsonc"));
  // When
  const result = await f.adapter.inspect({ project: f.project });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "symlink-context" });
});
