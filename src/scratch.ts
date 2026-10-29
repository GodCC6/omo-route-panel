import { lstat, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const prefix = "omo-route-native-";
const marker = ".omo-route-panel-manifest.json";

export async function createMirrorRoot(base = tmpdir()): Promise<string> {
  const path = await mkdtemp(join(base, prefix));
  await writeFile(join(path, marker), JSON.stringify({ app: "omo-route-panel", kind: "native-mirror", pid: process.pid }), { mode: 0o600, flag: "wx" });
  return path;
}

export async function cleanupMirrors(base = tmpdir()): Promise<void> {
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
    const path = join(base, entry.name);
    let manifest: unknown;
    try {
      const stat = await lstat(path);
      if (!stat.isDirectory() || (process.getuid && stat.uid !== process.getuid())) continue;
      if (!(await lstat(join(path, marker))).isFile()) continue;
      manifest = JSON.parse(await readFile(join(path, marker), "utf8"));
    } catch (error) {
      if (error instanceof SyntaxError || (error instanceof Error && "code" in error && error.code === "ENOENT")) continue;
      throw error;
    }
    if (!manifest || typeof manifest !== "object" || !("app" in manifest) || manifest.app !== "omo-route-panel"
      || !("kind" in manifest) || manifest.kind !== "native-mirror" || !("pid" in manifest)
      || typeof manifest.pid !== "number" || !Number.isInteger(manifest.pid) || manifest.pid <= 0) continue;
    try { process.kill(manifest.pid, 0); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH") {
        await rm(path, { recursive: true, force: true });
        continue;
      }
      if (error instanceof Error && "code" in error && error.code === "EPERM") continue;
      throw error;
    }
  }
}
