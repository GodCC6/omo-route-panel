import { realpath, stat } from "node:fs/promises";
import { basename } from "node:path";
import { NativeError } from "./native/config.js";
import { runProcess } from "./native/process.js";
import { fileDigest } from "./runtime.js";

export async function catalogExecutable(pid: number, signal: AbortSignal): Promise<string> {
  if (process.platform === "linux") return realpath(`/proc/${pid}/exe`);
  if (process.platform !== "darwin") throw new NativeError("catalog-platform");
  const executable = (await runProcess({
    executable: "/bin/ps", args: ["-p", String(pid), "-o", "comm="],
    cwd: "/", env: { LC_ALL: "C" }, input: "", timeoutMs: 5000, signal,
  })).trim();
  if (!executable || executable.includes("\n")) throw new NativeError("catalog-engine-mismatch");
  if (executable.startsWith("/")) return realpath(executable);
  // ps preserves a basename when a program was launched through PATH.
  const mapped = await runProcess({
    executable: "/usr/sbin/lsof", args: ["-a", "-p", String(pid), "-d", "txt", "-F", "n"],
    cwd: "/", env: { LC_ALL: "C" }, input: "", timeoutMs: 5000, signal,
  });
  const candidates = mapped.split("\n").filter((line) => line.startsWith("n/") && basename(line.slice(1)) === basename(executable));
  const candidate = candidates[0];
  if (candidates.length !== 1 || candidate === undefined) throw new NativeError("catalog-engine-mismatch");
  return realpath(candidate.slice(1));
}

export async function verifyCatalogExecutable(pid: number, expected: string, signal: AbortSignal): Promise<string | undefined> {
  const executable = await catalogExecutable(pid, signal);
  const before = await stat(executable, { bigint: true });
  if (process.platform === "darwin") {
    const mapped = await runProcess({
      executable: "/usr/sbin/lsof", args: ["-a", "-p", String(pid), "-d", "txt", "-F", "Din"],
      cwd: "/", env: { LC_ALL: "C" }, input: "", timeoutMs: 5000, signal,
    });
    if (!mappedExecutableMatches(mapped, { path: executable, dev: before.dev, ino: before.ino })) return undefined;
  } else {
    const mapped = await stat(`/proc/${pid}/exe`, { bigint: true });
    if (mapped.dev !== before.dev || mapped.ino !== before.ino) return undefined;
  }
  const digest = await fileDigest(executable);
  const after = await stat(executable, { bigint: true });
  return digest === expected && before.dev === after.dev && before.ino === after.ino
    && before.size === after.size && before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs ? executable : undefined;
}

/** lsof -F emits one f-delimited file record; names alone cannot prove the mapped image. */
export function mappedExecutableMatches(output: string, file: {
  readonly path: string; readonly dev: bigint; readonly ino: bigint;
}): boolean {
  let dev: bigint | undefined;
  let ino: bigint | undefined;
  let name: string | undefined;
  let matches = 0;
  let valid = false;
  const finish = (): void => {
    if (name !== file.path) return;
    matches++;
    valid = dev === file.dev && ino === file.ino;
  };
  for (const line of output.split("\n")) {
    if (line.startsWith("f")) {
      finish();
      dev = undefined; ino = undefined; name = undefined;
    } else if (/^D0x[0-9a-f]+$/i.test(line)) dev = BigInt(line.slice(1));
    else if (/^i\d+$/.test(line)) ino = BigInt(line.slice(1));
    else if (line.startsWith("n")) name = line.slice(1);
  }
  finish();
  return matches === 1 && valid;
}
