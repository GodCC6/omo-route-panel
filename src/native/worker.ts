import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// This entry is bound to the current installation in a permission-limited Node.
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
try {
  const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof input !== "object" || input === null || !("module" in input) || typeof input.module !== "string"
    || !("digest" in input) || typeof input.digest !== "string"
    || !("operation" in input) || !["modelChains", "configDoctorLines"].includes(String(input.operation))
    || !("request" in input)) throw new Error("invalid-input");
  const digest = createHash("sha256").update(readFileSync(input.module)).digest("hex");
  if (digest !== input.digest) throw new Error("fingerprint-changed");
  const native: unknown = await import(pathToFileURL(input.module).href);
  if (typeof native !== "object" || native === null) throw new Error("exports");
  const method = Reflect.get(native, String(input.operation));
  if (typeof method !== "function") throw new Error("exports");
  const result: unknown = await method(input.request);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  // No raw exceptions: upstream diagnostics can contain arbitrary config values.
  if (error instanceof Error && "code" in error && error.code === "ERR_ACCESS_DENIED") {
    process.stdout.write('{"nativeError":"permission"}');
  } else process.stdout.write('{"nativeError":"report"}');
  process.exitCode = 1;
}
