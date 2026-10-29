import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, appendFile, chmod, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixture = JSON.parse(await readFile(new URL("./host-fixture.json", import.meta.url), "utf8"));
const platform = `${process.platform}-${process.arch}`;
const checksum = fixture.assets[platform];
assert.ok(checksum, `No reviewed native test host for ${platform}; supply OMO_LAUNCHER_PATH instead.`);
const workspace = await mkdtemp(join(tmpdir(), "route-test-host-"));
const home = join(workspace, "home");
await mkdir(home);
async function run(executable, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: workspace,
      env: { HOME: home, PATH: process.env.PATH, PI_OFFLINE: "1", SENPI_OFFLINE: "1" },
      stdio: "inherit", timeout: 300000,
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0 && signal === null) resolve();
      else reject(new Error(`Test host preparation failed: ${executable} (exit ${code}, signal ${signal}).`));
    });
  });
}
try {
  const executable = join(workspace, "omo");
  await run("curl", ["--fail", "--location", "--silent", "--show-error", "--output", executable,
    `https://github.com/code-yeongyu/oh-my-openagent/releases/download/v${fixture.version}/omo-${platform}`]);
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(executable)) digest.update(chunk);
  assert.equal(digest.digest("hex"), checksum, "The official test host must match its reviewed release checksum.");
  await chmod(executable, 0o700);
  await run(executable, ["--version"]);
  const runtime = join(home, ".omo", "binary-runtime", fixture.version);
  const launcher = join(runtime, "omo");
  await access(launcher);
  const manifest = JSON.parse(await readFile(join(runtime, "package.json"), "utf8"));
  assert.equal(manifest.name, "omo");
  assert.equal(manifest.version, fixture.version);
  const output = `OMO_LAUNCHER_PATH=${launcher}\nOMO_TEST_HOST_DIRECTORY=${workspace}\n`;
  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_ENV) {
    await appendFile(process.env.GITHUB_ENV, output);
  }
  console.log(output.trimEnd());
} catch (error) {
  await rm(workspace, { recursive: true, force: true });
  throw error;
}
