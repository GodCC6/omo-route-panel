import { digest, NativeError, object } from "./config.js";
import type { NativeCatalog, NativeModel } from "./types.js";

/** Only these fields can leave the engine metadata boundary. */
export function sanitizeModels(input: unknown): readonly NativeModel[] {
  if (!Array.isArray(input)) throw new NativeError("catalog-shape");
  return input.map((value: unknown): NativeModel => {
    if (!object(value) || typeof value["provider"] !== "string" || typeof value["id"] !== "string"
      || !value["provider"] || !value["id"]) throw new NativeError("catalog-shape");
    const name = typeof value["name"] === "string" ? value["name"] : undefined;
    const reasoning = typeof value["reasoning"] === "boolean" ? value["reasoning"] : undefined;
    const modalities = value["input"];
    const acceptedInput = Array.isArray(modalities) && modalities.every((v: unknown) => v === "text" || v === "image")
      ? modalities.filter((v: unknown): v is string => typeof v === "string") : undefined;
    const contextWindow = finite(value["contextWindow"]);
    const maxTokens = finite(value["maxTokens"]);
    const costInput = value["cost"];
    const cost: Record<string, number> = {};
    if (object(costInput)) {
      for (const key of ["input", "output", "cacheRead", "cacheWrite"]) {
        const amount = finite(costInput[key]);
        if (amount !== undefined) cost[key] = amount;
      }
    }
    return {
      provider: value["provider"], id: value["id"],
      ...(name === undefined ? {} : { name }),
      ...(reasoning === undefined ? {} : { reasoning }),
      ...(acceptedInput === undefined ? {} : { input: acceptedInput }),
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(maxTokens === undefined ? {} : { maxTokens }),
      ...(Object.keys(cost).length === 0 ? {} : { cost }),
    };
  });
}
function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
export function catalogSnapshot(models: unknown, capturedAt = new Date().toISOString()): NativeCatalog {
  try {
    const safe = [...sanitizeModels(models)].sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));
    return {
      status: "ok", models: safe, capturedAt,
      revision: digest(JSON.stringify(safe)),
    };
  } catch (error) {
    if (error instanceof NativeError) return { status: "unknown", code: error.code };
    throw error;
  }
}
