import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/stage-release.mjs", import.meta.url));

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), "route-stage-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  await mkdir(bin);
  const npm = join(bin, "npm");
  await writeFile(npm, `#!${process.execPath}
const fs = require("node:fs");
fs.writeFileSync(process.env.ARGUMENTS_FILE, JSON.stringify(process.argv.slice(2)));
process.exit(Number(process.env.NPM_EXIT_CODE ?? 0));
`);
  await chmod(npm, 0o700);
  const tarball = join(root, "verified.tgz");
  await writeFile(tarball, "synthetic artifact");
  const argumentsFile = join(root, "arguments.json");
  async function run(args: readonly string[], code = 0): Promise<number | null> {
    return new Promise((done, reject) => {
      const child = spawn(process.execPath, [script, ...args], {
        env: { PATH: bin, ARGUMENTS_FILE: argumentsFile, NPM_EXIT_CODE: String(code) },
        stdio: "ignore", timeout: 10000,
      });
      child.once("error", reject);
      child.once("close", done);
    });
  }
  return { tarball, argumentsFile, run };
}

test("release staging delegates only the verified tarball to npm stage publish", async (t) => {
  // Given a synthetic npm boundary and one verified artifact.
  const f = await fixture(t);
  // When staging the artifact.
  const code = await f.run([f.tarball]);
  // Then direct publication and approval are never invoked.
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(await readFile(f.argumentsFile, "utf8")),
    ["stage", "publish", f.tarball, "--access", "public", "--ignore-scripts"]);
});

test("release staging preserves npm rejection instead of reporting success", async (t) => {
  // Given a registry boundary which rejects staging.
  const f = await fixture(t);
  // When staging fails.
  const code = await f.run([f.tarball], 17);
  // Then the workflow observes that failure.
  assert.equal(code, 17);
});

test("release staging rejects multiple or unpacked inputs before invoking npm", async (t) => {
  // Given valid fixture resources.
  const f = await fixture(t);
  // When the input does not identify exactly one packed artifact.
  const codes = await Promise.all([f.run([]), f.run([f.tarball, f.tarball]), f.run([join(f.tarball, "..")])]);
  // Then no staging command can be admitted.
  assert.ok(codes.every((code) => code !== 0));
  await assert.rejects(readFile(f.argumentsFile), { code: "ENOENT" });
});
