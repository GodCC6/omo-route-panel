import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, lstat, realpath, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fieldPaths, nodeValue, readDocument } from "./config.js";
import type { Journal } from "./config.js";
import { PanelError } from "./errors.js";
import { identifier, json, object } from "./validation.js";

export type UndoRecord = Journal & { readonly id: string };
type RecordState = {
  readonly current: UndoRecord | null;
  readonly pending?: { readonly journal: UndoRecord; readonly undo: boolean };
};

function journal(input: unknown, targets: readonly string[]): UndoRecord {
  const entry = object(input);
  const group = entry["group"];
  const target = entry["path"];
  if (typeof entry["id"] !== "string" || !entry["id"]
    || (group !== "native" && group !== "settings") || typeof target !== "string" || !targets.includes(target)
    || typeof entry["beforeRevision"] !== "string" || typeof entry["afterRevision"] !== "string"
    || !Array.isArray(entry["nodes"]) || !Array.isArray(entry["created"])) {
    throw new PanelError("invalid-undo", "The undo record is invalid.");
  }
  const allowed = (path: readonly string[]): boolean => {
    if (Object.values(fieldPaths[group]).some((field) => isDeepStrictEqual(field, path))) return true;
    return group === "native" && path.length === 4 && path[0] === "[native]"
      && (path[1] === "categories" || path[1] === "agents") && typeof path[2] === "string"
      && identifier(path[2]) === path[2]
      && ["models", "model", "fallback_models", "reasoning", "reasoningEffort", "variant"].includes(path[3] ?? "");
  };
  const nodes = entry["nodes"].map((value: unknown) => {
    const node = object(value);
    const path = node["path"];
    if (!Array.isArray(path) || !path.every((part: unknown): part is string => typeof part === "string") || !allowed(path)) {
      throw new PanelError("invalid-undo", "The undo record contains unsupported fields.");
    }
    return { path, before: node["before"] === undefined ? undefined : json(node["before"]), after: node["after"] === undefined ? undefined : json(node["after"]) };
  });
  const created = entry["created"].map((value: unknown) => {
    if (!Array.isArray(value) || !value.every((part: unknown): part is string => typeof part === "string")
      || !nodes.some((node) => value.length < node.path.length && value.every((part, index) => node.path[index] === part))) {
      throw new PanelError("invalid-undo", "The undo record contains an invalid container.");
    }
    return value;
  });
  return { id: entry["id"], group, path: target, beforeRevision: entry["beforeRevision"], afterRevision: entry["afterRevision"], nodes, created };
}

/** One record only; a pending entry covers interruption at the rename boundary. */
export async function loadUndo(stateDir: string, targets: readonly string[]): Promise<UndoRecord | null> {
  const doc = await readDocument(join(stateDir, "latest.json"));
  if (!doc.exists) return null;
  const state = object(doc.value);
  const current = state["current"] === null ? null : journal(state["current"], targets);
  if (state["pending"] === undefined) return current;
  const pending = object(state["pending"]);
  const candidate = journal(pending["journal"], targets);
  const saved = await readDocument(candidate.path);
  const matches = candidate.nodes.every((node) => isDeepStrictEqual(nodeValue(saved, node.path), node.after));
  return matches ? pending["undo"] === true ? null : candidate : current;
}

export async function undoWriter(stateDir: string): Promise<{
  readonly publish: (value: RecordState) => void;
  readonly close: () => Promise<void>;
}> {
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const stat = await lstat(stateDir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0
    || await realpath(stateDir) !== resolve(stateDir)) {
    throw new PanelError("unsafe-state", "The undo directory must be private and must not be symlinked.");
  }
  const lock = join(stateDir, "save.lock");
  try { await mkdir(lock, { mode: 0o700 }); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") throw new PanelError("locked", "Another Route Panel save holds the undo lock. After an abnormal exit, inspect the local save.lock directory.");
    throw error;
  }
  const publish = (value: RecordState): void => {
    const path = join(stateDir, "latest.json");
    const temp = join(stateDir, `latest-${randomUUID()}.tmp`);
    const fd = openSync(temp, "wx", 0o600);
    try {
      try { writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temp, path);
    } finally { rmSync(temp, { force: true }); }
  };
  return { publish, close: () => rm(lock, { recursive: true, force: true }) };
}
