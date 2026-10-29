import { test } from "node:test";
import assert from "node:assert/strict";
import { runProcess } from "../src/native/process.js";

test("aborted operations do not start a worker", async () => {
  // Given
  const controller = new AbortController();
  controller.abort();
  // When / Then
  await assert.rejects(runProcess({
    executable: "/this-file-does-not-exist", args: [], cwd: "/", env: {},
    input: "", timeoutMs: 2000, signal: controller.signal,
  }), { code: "process-aborted" });
});

test("abort kills the exact worker after its ready event", { timeout: 10000 }, async () => {
  // Given (the worker signals only after its server is listening)
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  const readySignal = process.report.signal === "SIGUSR2" ? "SIGURG" : "SIGUSR2";
  process.once(readySignal, abort);
  try {
    // When / Then
    await assert.rejects(runProcess({
      executable: process.execPath,
      args: ["--input-type=module", "-e", `import net from "node:net"; net.createServer().listen(0,"127.0.0.1",()=>process.kill(${process.pid},${JSON.stringify(readySignal)}));`],
      cwd: "/", env: {}, input: "", timeoutMs: 8000, signal: controller.signal,
    }), { code: "process-aborted" });
  } finally { process.off(readySignal, abort); }
});
