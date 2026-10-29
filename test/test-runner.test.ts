import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "route-test-runner-"));
  try {
    for (const dir of ["scripts", "test", "dist/test"]) await mkdir(join(root, dir), { recursive: true });
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await cp(fileURLToPath(new URL("../../scripts/test.mjs", import.meta.url)), join(root, "scripts/test.mjs"));
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

function runSuite(root: string, suite: "base" | "native"): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/test.mjs", suite], { cwd: root, env: {}, stdio: ["ignore", "pipe", "pipe"], timeout: 10000 });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}

test("base discovery ignores orphaned native and helper artifacts", async () => {
  await fixture(async (root) => {
    await writeFile(join(root, "test", "current.test.ts"), "");
    await writeFile(join(root, "dist/test/current.test.js"), "import { test } from 'node:test'; test('current', () => {});");
    for (const file of ["orphan.test.js", "other.native.test.js", "helper.js"]) {
      await writeFile(join(root, "dist/test", file), "throw new Error('ORPHAN_MUST_NOT_RUN');");
    }
    await writeFile(join(root, "test", "other.native.test.ts"), "");
    const result = await runSuite(root, "base");
    assert.equal(result.code, 0, result.output);
    assert.doesNotMatch(result.output, /ORPHAN_MUST_NOT_RUN/);
    assert.match(result.output, /SUITE=base FILES=1/);
  });
});

test("explicit native requests fail without a supplied installation", async () => {
  await fixture(async (root) => {
    const result = await runSuite(root, "native");
    assert.notEqual(result.code, 0);
    assert.match(result.output, /OMO_LAUNCHER_PATH/);
  });
});

test("missing current build output fails instead of running stale compiled tests", async () => {
  await fixture(async (root) => {
    await writeFile(join(root, "test", "renamed.test.ts"), "");
    await writeFile(join(root, "dist/test/old.test.js"), "");
    const result = await runSuite(root, "base");
    assert.notEqual(result.code, 0);
    assert.match(result.output, /ENOENT/);
  });
});
