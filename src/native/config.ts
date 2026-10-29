import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { parse } from "jsonc-parser";
import type { ParseError } from "jsonc-parser";
import type { ConfigObject, Json, NativeSource } from "./types.js";

export class NativeError extends Error {
  constructor(readonly code: string) { super(code); this.name = "NativeError"; }
}
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function json(value: unknown): value is Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(json);
  return object(value) && Object.entries(value).every(([key, item]) => !["__proto__", "constructor", "prototype"].includes(key) && json(item));
}
export function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
export function inside(home: string, path: string): boolean {
  const part = relative(home, path);
  return part === "" || (!part.startsWith(`..${sep}`) && part !== ".." && !isAbsolute(part));
}
const routeKeys = new Set([
  "model", "models", "fallback_models", "reasoning", "reasoningEffort", "variant",
  "disable", "categories", "category",
]);
const memoryKeys: Readonly<Record<string, readonly string[]>> = {
  recall: ["enabled", "category"], reflection: ["enabled", "category"],
  facts: ["enabled", "model"], dream: ["enabled", "idle_minutes", "min_hours_between", "shutdown_launch"],
  nudge: ["enabled"], sync: ["enabled"],
};
function select(value: unknown, keys: ReadonlySet<string>): ConfigObject {
  if (!object(value)) throw new NativeError("config-shape");
  const result: Record<string, Json> = {};
  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key)) {
      if (!json(item)) throw new NativeError("config-value");
      if (key === "models" || key === "fallback_models") {
        if (Array.isArray(item)) {
          result[key] = item.map((entry: unknown) => typeof entry === "string" ? entry
            : select(entry, new Set(["model", "reasoning", "variant", "reasoningEffort"])));
        } else if (key === "fallback_models" && typeof item === "string") result[key] = item;
        else throw new NativeError("config-shape");
      } else if (object(item)) throw new NativeError("config-shape");
      else if (Array.isArray(item) && (key !== "categories" || !item.every((entry: unknown) => typeof entry === "string"))) {
        throw new NativeError("config-shape");
      } else result[key] = item;
    }
  }
  return result;
}
/** This is a data projection, never a second route resolver. */
export function projectConfig(value: unknown): ConfigObject {
  if (!object(value)) throw new NativeError("config-shape");
  const result: Record<string, Json> = {};
  for (const key of ["categories", "agents"]) {
    const entries = value[key];
    if (entries === undefined) continue;
    if (!object(entries)) throw new NativeError("config-shape");
    result[key] = Object.fromEntries(Object.entries(entries).map(([id, item]) => [id, select(item, routeKeys)]));
  }
  // `models` is the OMO alias table, not the credential-bearing engine models.json.
  if (value["models"] !== undefined) {
    if (!object(value["models"])) throw new NativeError("config-shape");
    result["models"] = Object.fromEntries(Object.entries(value["models"]).map(([id, item]) => {
      if (typeof item === "string") return [id, item];
      return [id, select(item, new Set(["model", "reasoning"]))];
    }));
  }
  for (const key of ["exclude_models", "model_profile", "model_profiles"]) {
    const item = value[key];
    if (item !== undefined) {
      if (!json(item)) throw new NativeError("config-value");
      if (key === "model_profiles") {
        if (!object(item)) throw new NativeError("config-shape");
        result[key] = Object.fromEntries(Object.entries(item).map(([id, entry]) => [
          id, select(entry, new Set(["models", "display_name", "family", "tier", "caution"])),
        ]));
      } else if (key === "model_profile" && typeof item === "string") result[key] = item;
      else if (key === "exclude_models" && Array.isArray(item) && item.every((entry: unknown) => typeof entry === "string")) result[key] = item;
      else throw new NativeError("config-shape");
    }
  }
  if (value["memory"] !== undefined) {
    if (!object(value["memory"])) throw new NativeError("config-shape");
    const memory: Record<string, Json> = {};
    Object.assign(memory, select(value["memory"], new Set(["enabled", "agent", "auto_identity"])));
    for (const [key, keys] of Object.entries(memoryKeys)) {
      const item = value["memory"][key];
      if (item !== undefined) memory[key] = select(item, new Set(keys));
    }
    const agents = value["memory"]["agents"];
    if (agents !== undefined) {
      if (!object(agents)) throw new NativeError("config-shape");
      memory["agents"] = Object.fromEntries(Object.entries(agents).map(([id, entry]) => [
        id, projectConfig({ memory: entry })["memory"] ?? {},
      ]));
    }
    result["memory"] = memory;
  }
  for (const key of ["[native]", "[senpi]"]) {
    if (value[key] !== undefined) result[key] = projectConfig(value[key]);
  }
  if (value["profiles"] !== undefined) {
    if (!object(value["profiles"])) throw new NativeError("config-shape");
    result["profiles"] = Object.fromEntries(Object.entries(value["profiles"]).map(([name, item]) => [name, projectConfig(item)]));
  }
  return result;
}
function noSymlink(path: string): void {
  try {
    if (lstatSync(path).isSymbolicLink()) throw new NativeError("symlink-context");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}
export function discover(homeInput: string, projectInput: string): {
  readonly home: string; readonly project: string; readonly files: readonly NativeSource[]; readonly watchPaths: readonly string[];
} {
  const home = realpathSync(homeInput);
  const project = realpathSync(projectInput);
  const ancestors: string[] = [];
  let dir = project;
  for (let depth = 0; dir !== home; depth++) {
    if (depth >= 255) throw new NativeError("ancestor-depth");
    ancestors.unshift(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const files: NativeSource[] = [];
  const watchPaths: string[] = [];
  for (const base of [home, ...ancestors]) {
    const configDir = join(base, ".omo");
    watchPaths.push(configDir);
    noSymlink(configDir);
    const jsonc = join(configDir, "omo.jsonc");
    const plain = join(configDir, "omo.json");
    noSymlink(jsonc);
    noSymlink(plain);
    const path = existsSync(jsonc) ? jsonc : existsSync(plain) ? plain : undefined;
    if (path === undefined) {
      if (base === home) {
        const relativePath = relative(home, jsonc);
        files.push({
          sourceId: digest(relativePath).slice(0, 20), path: jsonc, relativePath,
          scope: "user", revision: "absent", config: {},
        });
      }
      continue;
    }
    const raw = readFileSync(path);
    if (raw.length > 2_000_000) throw new NativeError("config-too-large");
    const errors: ParseError[] = [];
    const value: unknown = parse(raw.toString("utf8").replace(/^\uFEFF/, ""), errors, { allowTrailingComma: true, disallowComments: false });
    if (errors.length > 0) throw new NativeError("config-parse");
    const relativePath = relative(home, path);
    files.push({
      sourceId: digest(relativePath).slice(0, 20), path, relativePath,
      scope: base === home ? "user" : "project", revision: digest(raw),
      config: projectConfig(value),
    });
  }
  return { home, project, files, watchPaths };
}
