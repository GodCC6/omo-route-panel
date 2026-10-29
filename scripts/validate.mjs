import { mkdtemp, cp, symlink, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const suite = process.argv[2] ?? "base";
if (suite !== "base" && suite !== "native") throw new Error("Use validate.mjs base or native.");
if (suite === "native" && !process.env.OMO_LAUNCHER_PATH) throw new Error("Native integration requires OMO_LAUNCHER_PATH.");
const workspace = await mkdtemp(join(tmpdir(), "route-validation-"));
async function run(executable, args) {
  const code = await new Promise((done, reject) => {
    const child = spawn(executable, args, { cwd: workspace, env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (status, signal) => done(signal ? 1 : status ?? 1));
  });
  if (code !== 0) throw new Error(`Validation command failed with exit ${code}: ${executable} ${args.join(" ")}`);
}
try {
  // Fresh output is guaranteed by a new directory; never delete the live dist.
  for (const path of ["src", "test", "scripts", "package.json", "bun.lock", "tsconfig.json", ".oxlintrc.json"]) {
    await cp(join(root, path), join(workspace, path), { recursive: true });
  }
  await symlink(join(root, "node_modules"), join(workspace, "node_modules"), "dir");
  console.log(`VALIDATION_SUITE=${suite} NODE=${process.version} LOCK_SHA256=${createHash("sha256").update(await readFile(join(root, "bun.lock"))).digest("hex")}`);
  console.log("Fresh temporary source copy; no existing dist artifacts or personal service output are used.");
  await run("bun", ["run", "check"]);
  await run("bun", ["run", "lint"]);
  await run("bun", ["run", "build"]);
  await run(process.execPath, ["scripts/test.mjs", suite]);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
