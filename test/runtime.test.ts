import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm, symlink, rename, copyFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { installedRuntime, nodeCapabilities, fileDigest } from "../src/runtime.js";
import { createNativeAdapter, catalogSnapshot } from "../src/native/index.js";
import { runProcess } from "../src/native/process.js";
import { syntheticCatalogAdapter } from "./native-fixture.js";

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const home = await mkdtemp(join(tmpdir(), "panel-runtime-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  async function runtime(name: string, root = join(home, name)) {
    await mkdir(join(root, "plugin/runtime/category-coverage"), { recursive: true });
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "omo", version: name, type: "module" }));
    await writeFile(join(root, "omo"), `synthetic launcher ${name}`);
    await writeFile(join(root, "plugin/runtime/category-coverage/index.js"), `
      export function modelChains() { return {categories:[],agents:[],excludeModels:[],modelProfile:{}}; }
      export function configDoctorLines() { return []; }
    `);
    return root;
  }
  return { home, runtime };
}

test("direct launcher discovery works without a runtime cache", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await f.runtime("direct");
  // When
  const found = await installedRuntime({ home: f.home, launcherPath: join(root, "omo") });
  // Then
  assert.equal(found.runtimeRoot, await realpath(root));
  assert.equal(found.launcherPath, await realpath(join(root, "omo")));
  assert.equal(found.launcherDigest, await fileDigest(join(root, "omo")));
});

test("linked launchers retain their source and canonical target without a cache", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await f.runtime("linked");
  const launcher = join(f.home, "active");
  await symlink(join(root, "omo"), launcher);
  // When
  const found = await installedRuntime({ home: f.home, launcherPath: relative(process.cwd(), launcher) });
  // Then
  assert.equal(found.launcherSourcePath, launcher);
  assert.equal(found.launcherPath, await realpath(join(root, "omo")));
  assert.equal(found.version, "linked");
});

test("copied launchers select the digest match rather than a newer cached runtime", async (t) => {
  // Given
  const f = await fixture(t);
  await f.runtime("999-newer", join(f.home, ".omo/binary-runtime/999-newer"));
  const root = await f.runtime("matching", join(f.home, ".omo/binary-runtime/matching"));
  const launcher = join(f.home, "copied");
  await copyFile(join(root, "omo"), launcher);
  // When
  const found = await installedRuntime({ home: f.home, launcherPath: launcher });
  // Then
  assert.equal(found.runtimeRoot, await realpath(root));
  assert.equal(found.launcherPath, await realpath(launcher));
  assert.equal(found.version, "matching");
});

for (const input of ["directory", "dangling", "unmatched"] as const) {
  test(`launcher discovery rejects ${input} input without fallback`, async (t) => {
    // Given
    const f = await fixture(t);
    await f.runtime("unrelated", join(f.home, ".omo/binary-runtime/unrelated"));
    const launcher = join(f.home, "invalid");
    if (input === "directory") await mkdir(launcher);
    else if (input === "dangling") await symlink(join(f.home, "missing"), launcher);
    else await writeFile(launcher, "no matching runtime");
    // When / Then
    await assert.rejects(installedRuntime({ home: f.home, launcherPath: launcher }), {
      code: input === "unmatched" ? "engine-launcher-mismatch" : "engine-launcher-invalid",
    });
  });
}

test("an explicit mismatched runtime root never bypasses launcher identity", async (t) => {
  // Given
  const f = await fixture(t);
  const root = await f.runtime("first");
  const other = await f.runtime("other");
  // When / Then
  await assert.rejects(installedRuntime({ home: f.home, launcherPath: join(root, "omo"), runtimeRoot: other }), {
    code: "engine-launcher-mismatch",
  });
});

test("existing adapters rediscover a replaced launcher and preserve report equivalence", async (t) => {
  // Given
  const f = await fixture(t);
  const first = await f.runtime("first");
  const second = await f.runtime("second");
  const launcher = join(f.home, "active");
  const node = join(f.home, "selected-node");
  const prefix = join(f.home, "node-install");
  const binary = join(prefix, "bin/node");
  await symlink(join(first, "omo"), launcher);
  await mkdir(dirname(binary), { recursive: true });
  await copyFile(process.execPath, binary);
  // Retain the selected distribution's dynamic-library layout when relocating Node.
  await symlink(join(dirname(dirname(await realpath(process.execPath))), "lib"), join(prefix, "lib"));
  await symlink(binary, node);
  const adapter = syntheticCatalogAdapter({ home: f.home, launcherPath: launcher, nodePath: node }, catalogSnapshot([]));
  const initial = await adapter.inspect({ project: f.home });
  assert.equal(initial.status, "ok", JSON.stringify(initial));
  await symlink(join(second, "omo"), `${launcher}.next`);
  // When
  await rename(`${launcher}.next`, launcher);
  const result = await adapter.resolve({ project: f.home, catalog: catalogSnapshot([]) });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status === "ok") {
    assert.equal(result.value.inspection.engine.version, "second");
    assert.equal(result.value.inspection.engine.launcherSourcePath, launcher);
    assert.equal(result.value.inspection.engine.nodeSourcePath, node);
    assert.equal(result.value.inspection.engine.nodePath, await realpath(binary));
    assert.equal(result.value.equivalence, "equal");
  }
});

test("Node capability selection defaults to the running executable", async () => {
  // Given / When
  const node = await nodeCapabilities();
  // Then
  assert.equal(node.nodePath, await realpath(process.execPath));
  assert.equal(node.nodeVersion, process.version);
});

test("Node overrides resolve relative to cwd and retain canonical identity", async (t) => {
  // Given
  const f = await fixture(t);
  const source = join(f.home, "node");
  await symlink(process.execPath, source);
  // When
  const node = await nodeCapabilities(relative(process.cwd(), source));
  // Then
  assert.equal(node.nodeSourcePath, source);
  assert.equal(node.nodePath, await realpath(process.execPath));
});

test("native inspection rejects an invalid explicit Node override instead of using a default", async (t) => {
  // Given
  const f = await fixture(t);
  // When
  const root = await f.runtime("invalid-node");
  const result = await createNativeAdapter({
    home: f.home, launcherPath: join(root, "omo"), nodePath: join(f.home, "missing-node"),
  }).inspect({ project: f.home });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "node-path-invalid" });
});

test("commands without request input do not create a writable stdin pipe", async (t) => {
  // Given
  const f = await fixture(t);
  // When
  const raw = await runProcess({
    executable: process.execPath,
    args: ["--input-type=module", "-e", 'import { fstatSync } from "node:fs";process.stdout.write(JSON.stringify({ignored:fstatSync(0).isCharacterDevice()}));'],
    cwd: f.home, env: {}, input: "", timeoutMs: 5000,
  });
  // Then
  assert.deepEqual(JSON.parse(raw), { ignored: true });
});

test("process output preserves multibyte identifiers across pipe chunks", async (t) => {
  // Given
  const f = await fixture(t);
  const count = 40000;
  const expected = "\u5916\u90e8".repeat(count);
  // When
  const output = await runProcess({
    executable: process.execPath, args: ["-e", `process.stdout.write("\\u5916\\u90e8".repeat(${count}));`],
    cwd: f.home, env: {}, input: "", timeoutMs: 5000,
  });
  // Then
  assert.equal(Buffer.from(output).equals(Buffer.from(expected)), true);
});

test("Node rejects executables lacking the required permission flags", async () => {
  // Given / When / Then
  await assert.rejects(nodeCapabilities("/usr/bin/true"), { code: "node-capability" });
});

test("selected Node denies filesystem writes network and child processes", async (t) => {
  // Given
  const f = await fixture(t);
  const { nodePath } = await nodeCapabilities();
  // When
  const result = await runProcess({
    executable: nodePath, cwd: f.home, env: {}, input: "", timeoutMs: 5000,
    args: ["--permission", "--no-addons", "--no-warnings", "--input-type=module", "-e", `
      import fs from "node:fs";
      import cp from "node:child_process";
      import net from "node:net";
      let denied = 0;
      for (const operation of [
        () => fs.readFileSync("omo.jsonc"),
        () => fs.writeFileSync("not-created", "x"),
        () => cp.spawnSync("true"),
      ]) {
        try { operation(); } catch (error) { if (error.code === "ERR_ACCESS_DENIED") denied++; else throw error; }
      }
      await new Promise((resolve, reject) => {
        const failed = error => error.code === "ERR_ACCESS_DENIED" ? (denied++, resolve()) : reject(error);
        try { net.connect({host:"127.0.0.1",port:9}).once("error", failed); } catch (error) { failed(error); }
      });
      console.log(JSON.stringify({denied}));
    `],
  });
  // Then
  assert.deepEqual(JSON.parse(result), { denied: 4 });
});
