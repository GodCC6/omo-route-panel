import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";
import { PanelError } from "./errors.js";
import { json, reasoningLevels } from "./validation.js";
import type { FileChange, FileGroup, Json, Operation } from "./types.js";

export type Document = {
  readonly path: string;
  readonly text: string;
  readonly revision: string;
  readonly tree: Node;
  readonly value: Json;
  readonly mode: number;
  readonly exists: boolean;
};
export type NodeChange = {
  readonly path: readonly string[];
  readonly before: Json | undefined;
  readonly after: Json | undefined;
};
export type Edited = {
  readonly text: string;
  readonly nodes: readonly NodeChange[];
  readonly changes: readonly FileChange[];
  readonly created: readonly (readonly string[])[];
};
export type Journal = {
  readonly group: FileGroup;
  readonly path: string;
  readonly beforeRevision: string;
  readonly afterRevision: string;
  readonly nodes: readonly NodeChange[];
  readonly created: readonly (readonly string[])[];
};

export function hash(text: string): string { return createHash("sha256").update(text).digest("hex"); }

export function parseDocument(text: string, path = "", mode = 0o600, exists = true): Document {
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (!tree || tree.type !== "object" || errors.length > 0) throw new PanelError("invalid-jsonc", "Configuration syntax is invalid; writes are disabled.");
  const inspect = (node: Node): void => {
    if (node.type === "object") {
      const keys = (node.children ?? []).map((property) => property.children?.[0]?.value);
      if (new Set(keys).size !== keys.length) throw new PanelError("duplicate-key", "Configuration contains duplicate keys; resolve the ambiguity manually.");
    }
    for (const child of node.children ?? []) inspect(child);
  };
  inspect(tree);
  return { path, text, revision: exists ? hash(text) : "absent", tree, value: json(getNodeValue(tree)), mode, exists };
}

export async function readDocument(path: string): Promise<Document> {
  let stat;
  try { stat = await lstat(path); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return parseDocument("{}\n", path, 0o600, false);
    }
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o022) !== 0 || (stat.mode & 0o200) === 0 || (stat.mode & 0o111) !== 0 || (process.getuid && stat.uid !== process.getuid())) {
    throw new PanelError("unsafe-file", "The target must be a regular file owned by this user with safe editing permissions.");
  }
  if (await realpath(dirname(path)) !== resolve(dirname(path))) throw new PanelError("unsafe-file", "Symlinked directories are read-only.");
  return parseDocument(await readFile(path, "utf8"), path, stat.mode & 0o777);
}

export function nodeValue(doc: Document, path: readonly string[]): Json | undefined {
  const node = findNodeAtLocation(doc.tree, [...path]);
  return node ? json(getNodeValue(node)) : undefined;
}

export const fieldPaths: Readonly<Record<FileGroup, Readonly<Record<string, readonly string[]>>>> = {
  native: Object.fromEntries([
    "memory.recall.category", "memory.recall.enabled", "memory.reflection.category",
    "memory.reflection.enabled", "memory.facts.model", "memory.facts.enabled",
    "memory.dream.enabled", "model_profile",
  ].map((field) => [field, ["[native]", ...field.split(".")]])),
  settings: {
    defaultProvider: ["defaultProvider"], defaultModel: ["defaultModel"],
    defaultThinkingLevel: ["defaultThinkingLevel"], "compaction.model": ["compaction", "model"],
  },
};

export function fieldPath(group: FileGroup, field: string): readonly string[] {
  const path = fieldPaths[group][field];
  if (!path) throw new PanelError("forbidden-path", "This field is outside the supported editing scope.");
  return path;
}

function validateField(field: string, value: Json): void {
  if (field.endsWith(".enabled")) {
    if (typeof value !== "boolean") throw new PanelError("invalid-field", "Switch values must be boolean.");
    return;
  }
  if (typeof value !== "string" || value.length === 0 || value.length > 300) throw new PanelError("invalid-field", "The field must be a nonempty string of at most 300 characters.");
  if (field === "defaultThinkingLevel" && !reasoningLevels.some((level) => level === value)) throw new PanelError("invalid-reasoning", "Unknown default reasoning level.");
}

function equal(a: Json | undefined, b: Json | undefined): boolean { return JSON.stringify(a) === JSON.stringify(b); }

function editsFor(ops: readonly Operation[], group: FileGroup): readonly { readonly path: readonly string[]; readonly value: Json | undefined }[] {
  return ops.flatMap<{ readonly path: readonly string[]; readonly value: Json | undefined }>((op) => {
    if (op.group !== group) throw new PanelError("mixed-groups", "Edit one configuration file at a time.");
    switch (op.kind) {
      case "set-chain":
      case "remove-override": {
        const prefix = ["[native]", op.target === "category" ? "categories" : "agents", op.id];
        const legacy = ["model", "fallback_models"];
        const changes = legacy.map((name) => ({ path: [...prefix, name], value: undefined }));
        return [{ path: [...prefix, "models"], value: op.kind === "set-chain" ? op.models.map((c) => c.reasoning ? { model: c.model, reasoning: c.reasoning } : { model: c.model }) : undefined }, ...changes];
      }
      case "set-field": {
        const path = fieldPath(group, op.field);
        validateField(op.field, op.value);
        return [{ path, value: op.value }];
      }
      case "remove-field": return [{ path: fieldPath(group, op.field), value: undefined }];
    }
  });
}

export function editDocument(doc: Document, ops: readonly Operation[], group: FileGroup): Edited {
  return editNodes(doc, editsFor(ops, group));
}

function editNodes(doc: Document, edits: readonly { readonly path: readonly string[]; readonly value: Json | undefined }[]): Edited {
  let text = doc.text;
  const keys = new Map<string, readonly string[]>();
  const created = new Map<string, readonly string[]>();
  for (const edit of edits) {
    if (edit.value === undefined && nodeValue(parseDocument(text), edit.path) === undefined) continue;
    keys.set(JSON.stringify(edit.path), edit.path);
    if (edit.value !== undefined) {
      for (let depth = 1; depth < edit.path.length; depth++) {
        const path = edit.path.slice(0, depth);
        const current = nodeValue(parseDocument(text), path);
        if (current === undefined) created.set(JSON.stringify(path), path);
        else if (current === null || typeof current !== "object" || Array.isArray(current)) throw new PanelError("invalid-container", "The target parent node is not an object.");
      }
    }
    text = applyEdits(text, modify(text, [...edit.path], edit.value, { formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" } }));
  }
  const after = parseDocument(text);
  const nodes = [...keys.values()].map((path) => ({ path, before: nodeValue(doc, path), after: nodeValue(after, path) })).filter((node) => !equal(node.before, node.after));
  return {
    text, nodes, created: [...created.values()],
    changes: nodes.map((change) => {
      const before = findNodeAtLocation(doc.tree, [...change.path]);
      const next = findNodeAtLocation(after.tree, [...change.path]);
      return {
        path: change.path.join("."),
        before: before ? doc.text.slice(before.offset, before.offset + before.length) : "(not set)",
        after: next ? text.slice(next.offset, next.offset + next.length) : "(remove layer override)",
        ...(!before ? { beforeKind: "unset" as const } : {}),
        ...(!next ? { afterKind: "removed" as const } : {}),
      };
    }),
  };
}

export function undoDocument(doc: Document, journal: Journal): Edited {
  if (doc.path !== journal.path) throw new PanelError("undo-conflict", "The undo target has changed.", 409);
  for (const node of journal.nodes) {
    if (!equal(nodeValue(doc, node.path), node.after)) throw new PanelError("undo-conflict", "Another tool changed a saved field; undo is denied.", 409);
  }
  const edited = editNodes(doc, journal.nodes.map((node) => ({ path: node.path, value: node.before })));
  let text = edited.text;
  for (const path of [...journal.created].sort((a, b) => b.length - a.length)) {
    const value = nodeValue(parseDocument(text), path);
    if (value !== undefined && value !== null && !Array.isArray(value) && typeof value === "object" && Object.keys(value).length === 0) {
      text = applyEdits(text, modify(text, [...path], undefined, {}));
    }
  }
  return { ...edited, text };
}

export type CommitHooks = {
  readonly beforeCommit?: () => Promise<void>;
  readonly writeTemp?: (path: string, text: string, mode: number) => Promise<void>;
  readonly backup?: (path: string, text: string) => Promise<void>;
  readonly rename?: (from: string, to: string) => Promise<void>;
};

export async function commitDocument(doc: Document, edited: Edited, group: FileGroup, stateDir: string, hooks: CommitHooks = {}): Promise<Journal> {
  const lock = join(dirname(doc.path), ".omo-route-panel.lock");
  await mkdir(dirname(doc.path), { recursive: true, mode: 0o700 });
  if (await realpath(dirname(doc.path)) !== resolve(dirname(doc.path))) throw new PanelError("unsafe-file", "Writing through symlinked directories is denied.");
  try { await mkdir(lock, { mode: 0o700 }); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") throw new PanelError("locked", "Another panel save holds the lock; inspect the local lock directory after an abnormal exit.", 409);
    throw error;
  }
  const temp = join(dirname(doc.path), `.omo-route-panel-${randomUUID()}.tmp`);
  try {
    const current = await readDocument(doc.path);
    if (current.revision !== doc.revision) throw new PanelError("conflict", "The file changed externally; Cancel and refresh.", 409);
    const journal: Journal = { group, path: doc.path, beforeRevision: doc.revision, afterRevision: hash(edited.text), nodes: edited.nodes, created: edited.created };
    await mkdir(stateDir, { recursive: true, mode: 0o700 });
    if ((await lstat(stateDir)).isSymbolicLink() || await realpath(stateDir) !== resolve(stateDir)) throw new PanelError("unsafe-state", "The journal directory must not be symlinked.");
    const backupPath = join(stateDir, `save-${randomUUID()}.json`);
    const backupText = JSON.stringify(journal, null, 2);
    if (hooks.backup) await hooks.backup(backupPath, backupText);
    else {
      const backup = await open(backupPath, "wx", 0o600);
      try { await backup.writeFile(backupText); await backup.sync(); } finally { await backup.close(); }
    }
    if (hooks.writeTemp) await hooks.writeTemp(temp, edited.text, doc.mode);
    else {
      const handle = await open(temp, "wx", doc.mode);
      try { await handle.writeFile(edited.text); await handle.sync(); } finally { await handle.close(); }
    }
    await hooks.beforeCommit?.();
    if ((await readDocument(doc.path)).revision !== doc.revision) throw new PanelError("conflict", "An external edit was detected before commit; Cancel and refresh.", 409);
    await (hooks.rename ?? rename)(temp, doc.path);
    if (hash(await readFile(doc.path, "utf8")) !== journal.afterRevision) throw new PanelError("post-save-conflict", "The file changed after saving; inspect it again.", 409);
    return journal;
  } finally {
    await rm(temp, { force: true });
    await rm(lock, { recursive: true, force: true });
  }
}
