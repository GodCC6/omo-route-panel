import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { NativeError, object } from "./native/config.js";
import { runProcess } from "./native/process.js";

const hashes = new Map<string, { readonly identity: string; readonly digest: string }>();

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
  const cache = join(home, ".omo", "binary-runtime");
  // Check the adjacent runtime before touching the optional cache.
  async function* candidates(): AsyncGenerator<string> {
    if (options.runtimeRoot) { yield options.runtimeRoot; return; }
    yield dirname(launcherPath);
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
      const manifest: unknown = JSON.parse(await readFile(join(runtimeRoot, "package.json"), "utf8"));
      if (!object(manifest) || manifest["name"] !== "omo" || typeof manifest["version"] !== "string") continue;
      const binary = await realpath(join(runtimeRoot, "omo"));
      if (!(await stat(binary)).isFile()) continue;
      if (binary !== launcherPath && await fileDigest(binary) !== launcherDigest) continue;
      return { version: manifest["version"], runtimeRoot, launcherPath, launcherSourcePath, launcherDigest };
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
