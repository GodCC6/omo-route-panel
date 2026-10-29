import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const documents = ["README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "CHANGELOG.md"];

/** Build and pack fresh source without touching the checkout's dist directory. */
export async function packExtension(destination) {
  await mkdir(destination, { recursive: true });
  const workspace = await mkdtemp(join(tmpdir(), "route-package-"));
  try {
    for (const path of ["src", "test", "scripts", "package.json", "tsconfig.json", ...documents]) {
      await cp(join(root, path), join(workspace, path), { recursive: true });
    }
    await symlink(join(root, "node_modules"), join(workspace, "node_modules"), "dir");
    let packed = "";
    await new Promise((done, reject) => {
        const child = spawn("npm", ["pack", "--silent", "--json", "--pack-destination", resolve(destination)], {
          cwd: workspace,
          env: {
            PATH: process.env.PATH, HOME: workspace,
            NPM_CONFIG_USERCONFIG: join(workspace, "empty-user.npmrc"),
            NPM_CONFIG_GLOBALCONFIG: join(workspace, "empty-global.npmrc"),
            NPM_CONFIG_CACHE: join(workspace, "npm-cache"),
          },
          stdio: ["ignore", "pipe", "inherit"],
          timeout: 120000,
        });
        child.stdout?.on("data", (chunk) => { packed += chunk.toString(); });
        child.once("error", reject);
        child.once("close", (code, signal) => {
          if (code === 0 && signal === null) done();
          else reject(new Error(`npm pack failed (exit ${code}, signal ${signal}).`));
        });
    });
    const result = JSON.parse(packed);
    assert.equal(result.length, 1, "Packing must produce exactly one package.");
    const report = result[0];
    const files = report.files.map((file) => file.path);
    for (const path of [...documents, "package.json", "dist/extension/index.js", "dist/src/extension.js", "dist/src/native/worker.js"]) {
      assert.ok(files.includes(path), `Missing release file: ${path}`);
    }
    for (const path of files) {
      assert.ok(
        path === "package.json" || documents.includes(path) || /^dist\/(?:src|extension)\/.*\.js$/.test(path),
        `Unexpected release file: ${path}`,
      );
    }
    return { tarball: join(resolve(destination), report.filename), integrity: report.integrity, files };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await packExtension(resolve(process.argv[2] ?? join(root, "artifacts")));
  console.log(`PACKAGE_TARBALL=${result.tarball}`);
  console.log(`PACKAGE_INTEGRITY=${result.integrity}`);
  console.log(`PACKAGE_FILES=${result.files.length}`);
}
