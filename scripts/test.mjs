import { readdir, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const suite = process.argv[2] ?? "base";
if (suite !== "base" && suite !== "native") throw new Error("Use test.mjs base or native.");
if (suite === "native" && !process.env.OMO_LAUNCHER_PATH) {
  throw new Error("Native integration requires OMO_LAUNCHER_PATH pointing to a supported OMO launcher.");
}
// Discover current source files, not leftover build artifacts or helper modules.
const tests = (await readdir(join(root, "test")))
  .filter((file) => file.endsWith(".test.ts") && file.endsWith(".native.test.ts") === (suite === "native"))
  .sort()
  .map((file) => join(root, "dist", "test", file.replace(/\.ts$/, ".js")));
if (tests.length === 0) throw new Error(`No current ${suite} test sources were found.`);
for (const file of tests) await access(file);
const executable = suite === "native" && process.env.OMO_NODE_PATH ? resolve(process.env.OMO_NODE_PATH) : process.execPath;
console.log(`SUITE=${suite} FILES=${tests.length}`);
const child = spawn(executable, ["--test", ...tests], { cwd: root, env: process.env, stdio: "inherit" });
child.once("error", () => { console.error("Unable to start the selected Node executable."); process.exitCode = 1; });
child.once("exit", (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
