import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { NativeError, object } from "./native/config.js";
import { runProcess } from "./native/process.js";

const hashes = new Map<string, { readonly identity: string; readonly digest: string }>();

/** A standalone runtime ships a native `omo` binary; a global npm package ships a JavaScript launcher. */
export type RuntimeLayout = "binary" | "npm";

/** Match one package root to the launcher's identity and supported host layout. */
async function runtimeMatch(runtimeRoot: string, launcherPath: string, launcherDigest: string): Promise<{
  readonly version: string;
  readonly runtimeRoot: string;
  readonly layout: RuntimeLayout;
} | undefined> {
  const manifest: unknown = JSON.parse(await readFile(join(runtimeRoot, "package.json"), "utf8"));
  if (!object(manifest) || typeof manifest["version"] !== "string") return undefined;
  if (manifest["name"] === "omo-ai") {
    // The npm package's declared `omo` entry is the launcher when OMO re-executes it under Bun or Node.
    const bin = manifest["bin"];
    const relative = typeof bin === "string" ? bin
      : object(bin) && typeof bin["omo"] === "string" ? bin["omo"] : undefined;
    if (relative === undefined) return undefined;
    const packaged = await realpath(join(runtimeRoot, relative)).catch(() => undefined);
    if (packaged !== launcherPath) return undefined;
    return { version: manifest["version"], runtimeRoot, layout: "npm" };
  }
  if (manifest["name"] !== "omo") return undefined;
  const binary = await realpath(join(runtimeRoot, "omo")).catch(() => undefined);
  if (binary === undefined || !(await stat(binary)).isFile()) return undefined;
  if (binary !== launcherPath && await fileDigest(binary) !== launcherDigest) return undefined;
  return { version: manifest["version"], runtimeRoot, layout: "binary" };
}

export async function fileDigest(path: string): Promise<string> {
  const info = await stat(path);
  const identity = `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
  const previous = hashes.get(path);
  if (previous?.identity === identity) return previous.digest;
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const digest = hash.digest("hex");
  hashes.set(path, { identity, digest });
  return digest;
}

export async function installedRuntime(options: {
  readonly launcherPath?: string;
  readonly runtimeRoot?: string;
  readonly home?: string;
} = {}): Promise<{
  readonly version: string;
  readonly runtimeRoot: string;
  readonly launcherPath: string;
  readonly launcherSourcePath: string;
  readonly launcherDigest: string;
  readonly layout: RuntimeLayout;
}> {
  const home = options.home ?? homedir();
  const launcherSourcePath = resolve(options.launcherPath ?? join(home, ".local", "bin", "omo"));
  let launcherPath: string;
  try {
    launcherPath = await realpath(launcherSourcePath);
    if (!(await stat(launcherPath)).isFile()) throw new NativeError("engine-launcher-invalid");
  } catch (error) {
    if (error instanceof NativeError) throw error;
    throw new NativeError("engine-launcher-invalid");
  }
  const launcherDigest = await fileDigest(launcherPath);
  const scriptLauncher = /\.(?:c|m)?js$/i.test(launcherPath);
  const cache = join(home, ".omo", "binary-runtime");
  // A JavaScript launcher lives in packageRoot/bin; a native launcher lives beside its runtime.
  // Check those package roots before touching the optional binary-runtime cache, and never read
  // the cache for a JavaScript launcher whose package layout is already known.
  async function* candidates(): AsyncGenerator<string> {
    if (options.runtimeRoot) { yield options.runtimeRoot; return; }
    const adjacent = dirname(launcherPath);
    yield adjacent;
    const packageRoot = dirname(adjacent);
    if (packageRoot !== adjacent) yield packageRoot;
    if (scriptLauncher) return;
    try {
      for (const entry of await readdir(cache, { withFileTypes: true })) {
        if (entry.isDirectory()) yield join(cache, entry.name);
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  for await (const candidate of candidates()) {
    try {
      const runtimeRoot = await realpath(candidate);
      const match = await runtimeMatch(runtimeRoot, launcherPath, launcherDigest);
      if (match === undefined) continue;
      return { ...match, launcherPath, launcherSourcePath, launcherDigest };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
  throw new NativeError("engine-launcher-mismatch");
}

/** Probe only Node itself, with no inherited environment or runtime imports. */
export async function nodeCapabilities(
  sourcePath = process.execPath,
  options: { readonly signal?: AbortSignal; readonly timeoutMs?: number } = {},
): Promise<{ readonly nodeSourcePath: string; readonly nodePath: string; readonly nodeVersion: string }> {
  const nodeSourcePath = resolve(sourcePath);
  try {
    const nodePath = await realpath(nodeSourcePath);
    if (!(await stat(nodePath)).isFile()) throw new NativeError("node-path-invalid");
    await access(nodePath, constants.X_OK);
    const nodeVersion = (await runProcess({
      executable: nodePath,
      args: ["--permission", "--no-addons", "--no-warnings", `--allow-fs-read=${nodePath}`, "--input-type=module", "-e", `
        const p = process.permission;
        if (!process.versions.node || process.versions.bun || !p
          || !p.has("fs.read", process.execPath)
          || ["fs.write", "child", "net", "addons"].some(scope => p.has(scope))
          || p.has("fs.read", "/")) process.exit(1);
        process.stdout.write(process.version);
      `],
      cwd: dirname(nodePath), env: {}, input: "", timeoutMs: options.timeoutMs ?? 5000,
      ...(options.signal ? { signal: options.signal } : {}),
    })).trim();
    if (!/^v\d+\.\d+\.\d+$/.test(nodeVersion)) throw new NativeError("node-capability");
    return { nodeSourcePath, nodePath, nodeVersion };
  } catch (error) {
    if (error instanceof NativeError) {
      if (error.code === "process-aborted") throw error;
      throw new NativeError("node-capability");
    }
    throw new NativeError("node-path-invalid");
  }
}
