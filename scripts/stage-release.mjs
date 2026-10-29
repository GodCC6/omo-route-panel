import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
assert.equal(args.length, 1, "Supply exactly one verified package tarball.");
const tarball = resolve(args[0]);
assert.ok(tarball.endsWith(".tgz"), "Supply a packed .tgz artifact, not a source directory.");
await access(tarball);
const child = spawn("npm", ["stage", "publish", tarball, "--access", "public", "--ignore-scripts"], {
  env: process.env, stdio: "inherit",
});
child.once("error", () => {
  console.error("Unable to start npm staging.");
  process.exitCode = 1;
});
child.once("close", (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
