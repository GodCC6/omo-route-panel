import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { packExtension } from "./pack.mjs";

const host = process.argv.includes("--host");
if (host && !process.env.OMO_LAUNCHER_PATH) throw new Error("Supply OMO_LAUNCHER_PATH for packaged-host acceptance.");
const root = fileURLToPath(new URL("../", import.meta.url));
const workspace = await mkdtemp(join(tmpdir(), "route-packaging-"));
try {
  // Given a fresh source build packed with the real npm file-selection rules.
  const { tarball, files, integrity } = await packExtension(
    resolvePath(process.env.OMO_PACKAGE_OUTPUT_DIR ?? join(workspace, "artifacts")),
  );
  assert.match(integrity, /^sha512-/);
  for (const installer of ["npm", "bun"]) {
    const consumer = join(workspace, installer);
    await mkdir(consumer);
    await writeFile(join(consumer, "package.json"), JSON.stringify({
      name: "synthetic-route-panel-consumer", version: "1.0.0", private: true,
    }));
    // When an account-free consumer installs the actual tarball normally.
    const args = installer === "npm"
      ? ["install", "--omit=dev", "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund", tarball]
      : ["add", "--production", "--ignore-scripts", tarball];
    const code = await new Promise((resolve, reject) => {
      const child = spawn(installer, args, {
        cwd: consumer,
        env: {
          PATH: process.env.PATH, HOME: consumer, BUN_CONFIG_NO_GLOBAL: "true",
          BUN_INSTALL_CACHE_DIR: join(consumer, "bun-cache"),
          NPM_CONFIG_USERCONFIG: join(consumer, "empty-user.npmrc"),
          NPM_CONFIG_GLOBALCONFIG: join(consumer, "empty-global.npmrc"),
          NPM_CONFIG_CACHE: join(consumer, "npm-cache"),
        },
        stdio: "inherit", timeout: 120000,
      });
      child.once("error", reject);
      child.once("close", (status, signal) => resolve(signal ? 1 : status));
    });
    assert.equal(code, 0, `${installer} must install the packed extension successfully.`);
    // Then runtime JSONC works, the generated entry ships, and the host stays external.
    const installed = join(consumer, "node_modules", "omo-route-panel");
    const manifest = JSON.parse(await readFile(join(installed, "package.json"), "utf8"));
    assert.equal(manifest.license, "MIT");
    assert.equal(manifest.private, undefined);
    assert.deepEqual(manifest.pi.extensions, ["./dist/extension/index.js"]);
    for (const file of files) await readFile(join(installed, file));
    const require = createRequire(join(installed, "package.json"));
    assert.deepEqual(require("jsonc-parser").parse('{"value": 7, /* comment */}'), { value: 7 });
    const dependencies = await readdir(join(consumer, "node_modules"), { recursive: true });
    assert.ok(!dependencies.some((file) => /(?:^|[/\\@])(?:pi-tui|senpi-tui|typescript|oxlint)(?:$|[/\\@])/.test(file)),
      `${installer} must not install a second TUI or development tools, even transitively.`);
    if (host) {
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [join(root, "scripts/test-tui.mjs")], {
          cwd: root,
          env: {
            PATH: process.env.PATH, HOME: consumer,
            OMO_LAUNCHER_PATH: process.env.OMO_LAUNCHER_PATH,
            OMO_ROUTE_PANEL_TEST_ENTRY: pathToFileURL(join(installed, manifest.pi.extensions[0])).href,
            ...(process.env.TUI_COLS ? { TUI_COLS: process.env.TUI_COLS } : {}),
            ...(process.env.TUI_ROWS ? { TUI_ROWS: process.env.TUI_ROWS } : {}),
            ...(process.env.TUI_THEME ? { TUI_THEME: process.env.TUI_THEME } : {}),
            ...(process.env.OMO_TUI_EVIDENCE_DIR ? { OMO_TUI_EVIDENCE_DIR: join(process.env.OMO_TUI_EVIDENCE_DIR, installer) } : {}),
          },
          stdio: "inherit", timeout: 240000,
        });
        child.once("error", reject);
        child.once("close", (status, signal) => {
          if (status === 0 && signal === null) resolve();
          else reject(new Error(`Packaged ${installer} host acceptance failed: exit ${status}, signal ${signal}.`));
        });
      });
    }
    console.log(`PACKAGING_OK installer=${installer} files=${files.length} integrity=${integrity}`);
  }
  console.log(`PACKAGE_TARBALL=${tarball}`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
