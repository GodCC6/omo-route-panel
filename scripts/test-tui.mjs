import { mkdtemp, cp, symlink, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.OMO_LAUNCHER_PATH) throw new Error("Supply OMO_LAUNCHER_PATH for native TUI acceptance.");
const root = fileURLToPath(new URL("../", import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), "route-tui-acceptance-"));
async function run(args) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (status, signal) => resolve(signal ? 1 : status ?? 1));
  });
  if (code !== 0) throw new Error(`TUI acceptance failed with exit ${code}.`);
}
try {
  await run([join(root, "node_modules/typescript/bin/tsc"), "--project", join(root, "tsconfig.json"), "--outDir", workspace]);
  await cp(join(root, "package.json"), join(workspace, "package.json"));
  await symlink(join(root, "node_modules"), join(workspace, "node_modules"), "dir");
  await run(["--test", join(workspace, "test/tui-host.acceptance.js")]);
} finally { await rm(workspace, { recursive: true, force: true }); }
