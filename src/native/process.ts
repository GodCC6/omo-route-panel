import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { NativeError } from "./config.js";

export interface ProcessInput {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly input: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}
/** No inherited environment, shell, error echo, or unbounded process output. */
export function runProcess(input: ProcessInput): Promise<string> {
  if (input.signal?.aborted) return Promise.reject(new NativeError("process-aborted"));
  return new Promise((resolve, reject) => {
    const child = input.input.length === 0
      ? spawn(input.executable, [...input.args], { cwd: input.cwd, env: input.env, stdio: ["ignore", "pipe", "pipe"] })
      : spawn(input.executable, [...input.args], { cwd: input.cwd, env: input.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    const decoder = new StringDecoder("utf8");
    let bytes = 0;
    let failure: NativeError | undefined;
    const fail = (code: string): void => {
      failure ??= new NativeError(code);
      child.kill("SIGKILL");
    };
    const timer = setTimeout(() => fail("process-timeout"), input.timeoutMs);
    const abort = (): void => fail("process-aborted");
    input.signal?.addEventListener("abort", abort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 4_000_000) { fail("process-output-limit"); return; }
      stdout += decoder.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 4_000_000) fail("process-output-limit");
    });
    child.stdin?.on("error", () => fail("process-input"));
    child.on("error", () => { failure ??= new NativeError("process-start"); });
    child.on("close", (code) => {
      stdout += decoder.end();
      clearTimeout(timer);
      input.signal?.removeEventListener("abort", abort);
      if (failure !== undefined) reject(failure);
      else if (code !== 0) reject(new NativeError(stdout === '{"nativeError":"permission"}' ? "report-permission" : stdout === '{"nativeError":"report"}' ? "report-exception" : "process-failed"));
      else resolve(stdout);
    });
    child.stdin?.end(input.input);
  });
}
