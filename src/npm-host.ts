import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { inside, NativeError, object } from "./native/config.js";

/** Inspect npm's nested/hoisted dependency without importing an ESM-only engine. */
async function enginePackage(runtimeRoot: string): Promise<{
  readonly root: string; readonly manifest: Record<string, unknown>;
}> {
  const paths = createRequire(join(runtimeRoot, "package.json")).resolve.paths("@code-yeongyu/senpi") ?? [];
  for (const path of paths) {
    // ESM does not use NODE_PATH or legacy global lookup directories.
    if (basename(path) !== "node_modules" || !inside(dirname(path), runtimeRoot)) continue;
    try {
      const root = await realpath(join(path, "@code-yeongyu", "senpi"));
      const manifest: unknown = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
      if (object(manifest) && manifest["name"] === "@code-yeongyu/senpi") return { root, manifest };
      throw new NativeError("host-installation-changed");
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  throw new NativeError("host-installation-changed");
}

/**
 * npm scripts have no mapped image to hash. Prove that the package files and
 * directory entries predate this process, including modules already in memory
 * before this extension was imported. ctime catches writes with preserved mtime.
 * Round the process origin down to tolerate one-second filesystem timestamps.
 */
async function unchangedPackage(root: string, before: bigint): Promise<void> {
  async function visit(path: string): Promise<void> {
    const info = await lstat(path, { bigint: true });
    if (info.ctimeNs <= 0n || info.ctimeNs >= before || info.isSymbolicLink()) {
      throw new NativeError("host-installation-changed");
    }
    // Dependencies are separate packages. The resolved engine is checked separately
    // whether npm nests it here or hoists it beside omo-ai.
    if (info.isDirectory() && path !== join(root, "node_modules")) {
      for (const name of await readdir(path)) await visit(join(path, name));
    }
  }
  await visit(root);
}

/** Bind the public loaded-plugin paths and actual main entry to unchanged npm artifacts. */
export async function verifyNpmHost(installation: {
  readonly runtimeRoot: string; readonly launcherSourcePath: string;
}, loadedPaths: readonly string[] | undefined): Promise<void> {
  try {
    if ((process.platform !== "darwin" && process.platform !== "linux") || loadedPaths === undefined) {
      throw new NativeError("host-installation-changed");
    }
    const entry = process.argv[1];
    if (entry === undefined) throw new NativeError("host-installation-changed");
    const { runtimeRoot } = installation;
    const before = BigInt(Math.floor(performance.timeOrigin / 1000)) * 1_000_000_000n;
    const sources = [installation.launcherSourcePath, entry];
    const engine = await enginePackage(runtimeRoot);
    const bin = engine.manifest["bin"];
    const declaredEntry = typeof bin === "string" ? bin
      : object(bin) && typeof bin["senpi"] === "string" ? bin["senpi"] : undefined;
    const engineEntry = declaredEntry === undefined ? undefined : await realpath(join(engine.root, declaredEntry));
    if (engineEntry === undefined || !inside(engine.root, engineEntry) || await realpath(resolve(entry)) !== engineEntry) {
      throw new NativeError("host-installation-changed");
    }
    const pluginRoot = join(runtimeRoot, "plugin");
    const plugin: unknown = JSON.parse(await readFile(join(pluginRoot, "package.json"), "utf8"));
    const pi = object(plugin) ? plugin["pi"] : undefined;
    const extensions = object(pi) ? pi["extensions"] : undefined;
    if (!Array.isArray(extensions) || extensions.length === 0) throw new NativeError("host-installation-changed");
    const loaded = await Promise.all(loadedPaths.filter(isAbsolute).map(async (path) => ({
      source: path, target: await realpath(path),
    })));
    for (const path of extensions) {
      if (typeof path !== "string") throw new NativeError("host-installation-changed");
      const extension = await realpath(join(pluginRoot, path));
      const match = loaded.find((loadedPath) => loadedPath.target === extension);
      if (!inside(pluginRoot, extension) || match === undefined) {
        throw new NativeError("host-installation-changed");
      }
      sources.push(match.source);
    }
    // A package manager can retarget an old package through a new symlink without
    // changing the target's timestamps. Check only the bound host paths.
    for (const source of sources) {
      for (let path = resolve(source); dirname(path) !== path; path = dirname(path)) {
        const info = await lstat(path, { bigint: true });
        if (info.isSymbolicLink() && (info.ctimeNs <= 0n || info.ctimeNs >= before)) {
          throw new NativeError("host-installation-changed");
        }
      }
    }
    await unchangedPackage(runtimeRoot, before);
    await unchangedPackage(engine.root, before);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    throw new NativeError("host-installation-changed");
  }
}
