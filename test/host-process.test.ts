import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { copyFile, mkdir, mkdtemp, realpath, rename, rm, symlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { catalogExecutable, mappedExecutableMatches, verifyCatalogExecutable } from "../src/catalog-process.js";
import { fileDigest } from "../src/runtime.js";
import { runProcess } from "../src/native/process.js";

test("matches a mapped executable by device and full precision inode", () => {
  // Given
  const file = { path: "/synthetic/launcher", dev: 0x100000en, ino: 1152921500312573255n };
  const output = "p123\nftxt\nD0x100000e\ni1152921500312573255\nn/synthetic/launcher\nftxt\nD0x100000e\ni3\nn/usr/lib/dyld\n";
  // When / Then
  assert.equal(mappedExecutableMatches(output, file), true);
});

test("rejects an old mapped inode at the replaced launcher path", () => {
  // Given
  const file = { path: "/synthetic/launcher", dev: 14n, ino: 200n };
  const output = "p123\nftxt\nD0xe\ni100\nn/synthetic/launcher\n";
  // When / Then
  assert.equal(mappedExecutableMatches(output, file), false);
  assert.equal(mappedExecutableMatches("p123\nftxt\nD0xf\ni200\nn/synthetic/launcher\n", file), false);
});

test("rejects missing or ambiguous mapped executable evidence", () => {
  // Given
  const file = { path: "/synthetic/launcher", dev: 14n, ino: 200n };
  // When / Then
  assert.equal(mappedExecutableMatches("p123\nftxt\nn/synthetic/launcher\n", file), false);
  assert.equal(mappedExecutableMatches("p123\nftxt\nD0xe\ni200\nn/synthetic/launcher\nftxt\nD0xe\ni200\nn/synthetic/launcher\n", file), false);
});

test("a process launched through PATH retains verifiable mapped executable identity", { timeout: 10000 }, async (t) => {
  // Given
  const child = spawn(basename(process.execPath), ["--input-type=module", "-e", "process.stdin.resume();process.stdout.write('READY\\n');"], {
    cwd: tmpdir(), env: { PATH: dirname(process.execPath) }, stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit", { signal: AbortSignal.timeout(5000) });
      child.kill();
      await exited;
    }
  });
  const ready = await once(child.stdout, "data", { signal: t.signal });
  assert.equal(String(ready[0]), "READY\n");
  assert.ok(child.pid);
  // When
  const executable = await catalogExecutable(child.pid, t.signal);
  const verified = await verifyCatalogExecutable(child.pid, await fileDigest(process.execPath), t.signal);
  // Then
  assert.equal(executable, await realpath(process.execPath));
  assert.equal(verified, executable);
  assert.equal(await verifyCatalogExecutable(child.pid, "0".repeat(64), t.signal), undefined);
  const exited = once(child, "exit", { signal: t.signal });
  child.stdin.end();
  await exited;
});

test("same-path same-digest replacement cannot authorize an old mapped executable", { timeout: 15000 }, async (t) => {
  // Given
  const home = await mkdtemp(join(await realpath(tmpdir()), "host-process-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const bin = join(home, "bin");
  await mkdir(bin);
  const executable = join(bin, "node");
  await copyFile(process.execPath, executable);
  // Preserve the selected Node distribution's relative dynamic-library layout.
  await symlink(join(dirname(dirname(await realpath(process.execPath))), "lib"), join(home, "lib"));
  const child = spawn(executable, ["--input-type=module", "-e", "process.stdin.resume();process.stdout.write('READY\\n');"], {
    cwd: home, env: {}, stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit", { signal: AbortSignal.timeout(5000) });
      child.kill();
      await exited;
    }
  });
  await once(child.stdout, "data", { signal: t.signal });
  assert.ok(child.pid);
  const digest = await fileDigest(executable);
  assert.equal(await verifyCatalogExecutable(child.pid, digest, t.signal), executable);
  await copyFile(process.execPath, `${executable}.next`);
  // When
  await rename(`${executable}.next`, executable);
  // Then
  assert.equal(await fileDigest(executable), digest);
  assert.equal(await verifyCatalogExecutable(child.pid, digest, t.signal), undefined);
  const exited = once(child, "exit", { signal: t.signal });
  child.stdin.end();
  await exited;
});

test("report processes retain bounded timeout and output limits after transport retirement", async () => {
  // Given / When / Then
  await assert.rejects(runProcess({
    executable: process.execPath, args: ["-e", "require('node:net').createServer().listen(0,'127.0.0.1')"],
    cwd: tmpdir(), env: {}, input: "", timeoutMs: 0,
  }), { code: "process-timeout" });
  await assert.rejects(runProcess({
    executable: process.execPath, args: ["-e", "process.stdout.write('x'.repeat(4_000_001))"],
    cwd: tmpdir(), env: {}, input: "", timeoutMs: 5000,
  }), { code: "process-output-limit" });
});
