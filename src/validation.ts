import { PanelError } from "./errors.js";
import type { Candidate, FileGroup, Json, Operation } from "./types.js";

export function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new PanelError("invalid-input", "The request must be an object.");
  }
  return Object.fromEntries(Object.entries(value));
}

export function string(value: unknown, max = 300): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new PanelError("invalid-input", "The string is empty or exceeds the permitted length.");
  }
  return value;
}

export function json(value: unknown): Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(json);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(object(value)).map(([key, item]) => [key, json(item)]));
  }
  throw new PanelError("invalid-input", "Unsupported configuration value.");
}

export function group(value: unknown): FileGroup {
  if (value !== "native" && value !== "settings") throw new PanelError("invalid-group", "Unknown file group.");
  return value;
}

export function identifier(value: unknown): string {
  const result = string(value, 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(result) || result === "constructor" || result === "prototype") {
    throw new PanelError("invalid-id", "Object names may contain only letters, numbers, underscores, and hyphens.");
  }
  return result;
}

export const reasoningLevels = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"] as const;

function candidate(value: unknown): Candidate {
  const item = object(value);
  const model = string(item["model"]);
  if (!model.includes("/") || /\s/.test(model)) throw new PanelError("invalid-model", "Select a complete provider/model identifier.");
  if (item["reasoning"] === undefined || item["reasoning"] === "") return { model };
  const reasoning = string(item["reasoning"]);
  if (!reasoningLevels.some((level) => level === reasoning)) throw new PanelError("invalid-reasoning", "Unknown reasoning level.");
  return { model, reasoning };
}

export function operations(value: unknown): readonly Operation[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) throw new PanelError("invalid-input", "Provide between 1 and 100 changes.");
  return value.map((entry): Operation => {
    const item = object(entry);
    switch (item["kind"]) {
      case "set-chain": {
        if (item["group"] !== "native") throw new PanelError("invalid-group", "Candidate chains may only be written to Native.");
        const target = item["target"];
        if (target !== "category" && target !== "agent") throw new PanelError("invalid-target", "Unknown route type.");
        if (!Array.isArray(item["models"]) || item["models"].length === 0 || item["models"].length > 30) throw new PanelError("invalid-chain", "A candidate chain must contain between 1 and 30 models.");
        return { kind: "set-chain", group: "native", target, id: identifier(item["id"]), models: item["models"].map(candidate) };
      }
      case "remove-override": {
        if (item["group"] !== "native") throw new PanelError("invalid-group", "Unknown file group.");
        const target = item["target"];
        if (target !== "category" && target !== "agent") throw new PanelError("invalid-target", "Unknown route type.");
        return { kind: "remove-override", group: "native", target, id: identifier(item["id"]) };
      }
      case "set-field": return { kind: "set-field", group: group(item["group"]), field: string(item["field"]), value: json(item["value"]) };
      case "remove-field": return { kind: "remove-field", group: group(item["group"]), field: string(item["field"]) };
      default: throw new PanelError("invalid-operation", "Unknown modification operation.");
    }
  });
}
