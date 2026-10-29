import { renameSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { backgroundRoutes } from "./background.js";
import { loadBackgroundEvidence } from "./background-evidence.js";
import type { BackgroundEvidence } from "./background-evidence.js";
import { commitDocument, editDocument, fieldPaths, nodeValue, parseDocument, readDocument, undoDocument } from "./config.js";
import type { Document, Edited } from "./config.js";
import { PanelError } from "./errors.js";
import { NATIVE_MODEL_PROFILES, projectConfig } from "./native/index.js";
import type { NativeAdapter, NativeContext, NativeResolution } from "./native/index.js";
import { declaredModelProfiles, presentRoutes, record } from "./presentation.js";
import type { EditorView, PanelController, PanelView, SaveOutcome, Scope } from "./tui-contract.js";
import type { FileGroup, Json, Operation } from "./types.js";
import { loadUndo, undoWriter } from "./undo.js";
import type { UndoRecord } from "./undo.js";
import { operations as parseOperations } from "./validation.js";

type Baseline = {
  readonly view: PanelView;
  readonly documents: Readonly<Record<FileGroup, Document>>;
  readonly evidence: BackgroundEvidence;
};
type Buffer = {
  readonly baseline: Baseline;
  readonly view: EditorView;
  readonly edited: Edited;
  readonly undoRecord: UndoRecord | null;
};

function fields(documents: Readonly<Record<FileGroup, Document>>): Readonly<Record<string, Json>> {
  return Object.fromEntries((["native", "settings"] as const).flatMap((group) =>
    Object.entries(fieldPaths[group]).flatMap(([name, path]) => {
      const value = nodeValue(documents[group], path);
      return value === undefined ? [] : [[`${group}:${name}`, value]];
    })));
}

function key(operation: Operation): string {
  switch (operation.kind) {
    case "set-chain": case "remove-override": return `${operation.group}:${operation.target}:${operation.id}`;
    case "set-field": case "remove-field": return `${operation.group}:${operation.field}`;
  }
}

export function createPanelController(options: {
  readonly home: string;
  readonly project: string;
  readonly registryContext: string;
  readonly adapter: NativeAdapter;
  readonly profile?: string;
  readonly signal: AbortSignal;
  readonly reload: () => Promise<void>;
  readonly notifySave?: (message: string, status: SaveOutcome["status"]) => void;
}): PanelController {
  const stateDir = join(options.home, ".local", "state", "omo-route-panel", "tui");
  let baseline: Baseline | null = null;
  let buffer: Buffer | null = null;
  let journal: UndoRecord | null = null;
  let busy = false;
  let ended = false;
  let epoch = 0;
  const context = (scope: Scope): NativeContext => ({
    project: scope === "user" ? options.home : options.project,
    ...(options.profile ? { profile: options.profile } : {}),
  });
  function alive(expected = epoch): void {
    if (ended || options.signal.aborted || epoch !== expected) throw new PanelError("editor-ended", "This editor has ended; reopen Route Panel.");
  }
  async function locked<T>(action: () => Promise<T>): Promise<T> {
    alive();
    if (busy) throw new PanelError("busy", "Another panel operation is still in progress.");
    busy = true;
    try { return await action(); } finally { busy = false; }
  }
  function current(): Baseline {
    alive();
    if (!baseline) throw new PanelError("not-loaded", "Refresh routing before editing.");
    return baseline;
  }
  async function unchanged(expected: Baseline, expectedEpoch: number): Promise<void> {
    alive(expectedEpoch);
    const inspected = await options.adapter.inspect(context(expected.view.scope));
    if (inspected.status !== "ok" || !isDeepStrictEqual(inspected.value, expected.view.inspection)) {
      throw new PanelError("conflict", "Routing configuration or its installation changed. Cancel and refresh.");
    }
    for (const doc of Object.values(expected.documents)) {
      const actual = await readDocument(doc.path);
      if (actual.revision !== doc.revision || actual.mode !== doc.mode) throw new PanelError("conflict", "A configuration file changed externally. Cancel and refresh.");
    }
    const catalog = await options.adapter.catalog(context(expected.view.scope));
    if (catalog.status !== "ok" || catalog.revision !== expected.view.catalog.revision) {
      throw new PanelError("catalog-changed", "The host model registry changed. Cancel and refresh.");
    }
    const evidence = await loadBackgroundEvidence(expected.view.inspection.engine.runtimeRoot);
    if (!isDeepStrictEqual(evidence.artifacts, expected.evidence.artifacts) || !isDeepStrictEqual(evidence.rules, expected.evidence.rules)
      || !isDeepStrictEqual(backgroundRoutes(expected.view.inspection, expected.view.resolution.effective.report, expected.view.fields, evidence, expected.view.scope), expected.view.background)) {
      throw new PanelError("context-changed", "Background implementation evidence or identity context changed. Cancel and refresh.");
    }
    alive(expectedEpoch);
  }
  async function read(scope: Scope): Promise<void> {
    if (buffer?.edited.nodes.length === 0) buffer = null;
    if (buffer) throw new PanelError("editing", "Apply or Cancel before changing scope or refreshing.");
    const expectedEpoch = epoch;
    const ctx = context(scope);
    const catalog = await options.adapter.catalog(ctx);
    if (catalog.status !== "ok") throw new PanelError(catalog.code, "The host model registry could not be read. No empty catalog was substituted.");
    const resolved = await options.adapter.resolve({ ...ctx, catalog });
    if (resolved.status !== "ok") throw new PanelError(resolved.code, "Native routing verification failed. Configuration is read-only until resolved.");
    const inspection = resolved.value.inspection;
    const source = inspection.files.find((file) => file.scope === "user");
    if (!source) throw new PanelError("source-missing", "The user configuration source could not be located.");
    const documents = { native: await readDocument(source.path), settings: await readDocument(inspection.settings.globalPath) };
    const evidence = await loadBackgroundEvidence(inspection.engine.runtimeRoot);
    const values = fields(documents);
    journal = await loadUndo(stateDir, [source.path, inspection.settings.globalPath]);
    const view: PanelView = {
      scope, registryContext: options.registryContext, inspection, resolution: resolved.value, catalog,
      routes: presentRoutes(resolved.value.effective.report, resolved.value.defaults.report, documents.native, inspection),
      background: backgroundRoutes(inspection, resolved.value.effective.report, values, evidence, scope),
      fields: values, files: { native: source.path, settings: inspection.settings.globalPath }, canUndo: journal?.group === "native",
      ...(journal?.group === "settings" ? { undoUnavailableReason: "The last save targets Settings, which this version no longer edits." } : {}),
    };
    const next = { view, documents, evidence };
    await unchanged(next, expectedEpoch);
    baseline = next;
  }
  function validate(ops: readonly Operation[], expected: Baseline): void {
    const ids = new Set(expected.view.catalog.models.map((model) => `${model.provider}/${model.id}`));
    for (const op of ops) {
      switch (op.kind) {
        case "set-chain":
          if (op.target === "agent" && !expected.view.routes.some((route) => route.kind === "agent" && route.id === op.id)) {
            throw new PanelError("unknown-agent", "Only existing native agents can be edited.");
          }
          for (const candidate of op.models) if (!ids.has(candidate.model)) throw new PanelError("unknown-model", "A candidate is absent from the host model registry.");
          break;
        case "set-field":
          if (op.field === "memory.facts.model" && !ids.has(String(op.value))) throw new PanelError("unknown-model", "Select a model from the host registry.");
          if (op.field.endsWith(".category") && !expected.view.routes.some((route) => route.kind === "category" && route.id === op.value)
            && !ops.some((item) => item.kind === "set-chain" && item.target === "category" && item.id === op.value)) {
            throw new PanelError("unknown-category", "The background category must exist in the combined changes.");
          }
          if (op.field === "model_profile") {
            const profiles = declaredModelProfiles(expected.view.inspection, expected.view.resolution.effective.report.configProfile);
            if (![...NATIVE_MODEL_PROFILES, ...profiles].some((name) => name === op.value)) throw new PanelError("unknown-profile", "Select a built-in or declared model profile.");
          }
          break;
        case "remove-override":
          if (op.target === "agent" && !expected.view.routes.some((route) => route.kind === "agent" && route.id === op.id)) throw new PanelError("unknown-agent", "Only existing native agents can be edited.");
          break;
        case "remove-field": break;
      }
    }
  }
  async function prepare(expected: Baseline, group: "native", ops: readonly Operation[], edited: Edited, undoRecord: UndoRecord | null): Promise<Buffer> {
    const expectedEpoch = epoch;
    let resolution: NativeResolution = expected.view.resolution;
    if (edited.nodes.length) {
      const source = expected.view.inspection.files.find((file) => file.scope === "user");
      if (!source) throw new PanelError("source-missing", "The user source is missing.");
      const result = await options.adapter.resolve({
        ...context(expected.view.scope), catalog: expected.view.catalog,
        candidate: { [source.sourceId]: projectConfig(parseDocument(edited.text).value) },
      });
      if (result.status !== "ok" || !result.value.candidate) throw new PanelError("candidate-invalid", "Native resolution rejected the combined changes. Nothing was saved.");
      resolution = result.value;
    }
    const report = resolution.candidate?.report ?? resolution.effective.report;
    const documents = { ...expected.documents, [group]: parseDocument(edited.text, expected.documents[group].path) };
    const values = fields(documents);
    const inspection = { ...resolution.inspection, files: resolution.inspection.files.map((file) =>
      file.scope === "user" ? { ...file, config: projectConfig(documents.native.value) } : file) };
    const evidence = await loadBackgroundEvidence(inspection.engine.runtimeRoot);
    const view: EditorView = {
      group, path: documents[group].path, operations: ops, changes: edited.changes, undo: undoRecord !== null,
      routes: presentRoutes(report, resolution.defaults.report, documents.native, inspection),
      background: backgroundRoutes(inspection, report, values, evidence, expected.view.scope),
      fields: values, modelProfile: report.modelProfile,
    };
    await unchanged(expected, expectedEpoch);
    return { baseline: expected, view, edited, undoRecord };
  }
  return {
    get view() { return baseline?.view ?? null; },
    get editor() { return buffer?.view ?? null; },
    read: (scope) => locked(() => read(scope)),
    begin: (group = "native") => {
      if (group !== "native") throw new PanelError("removed-settings", "Settings editing is not available in this extension.");
      if (busy || buffer) throw new PanelError("editing", "Apply or Cancel the existing editor first.");
      const expected = current();
      buffer = {
        baseline: expected, edited: editDocument(expected.documents[group], [], group), undoRecord: null,
        view: { group, path: expected.documents[group].path, operations: [], changes: [], routes: expected.view.routes,
          fields: expected.view.fields, background: expected.view.background, modelProfile: expected.view.resolution.effective.report.modelProfile, undo: false },
      };
    },
    change: (input) => locked(async () => {
      const expected = buffer;
      if (!expected || expected.view.undo) throw new PanelError("not-editing", "Open a file editor before changing entries.");
      const updates = parseOperations(input);
      if (updates.some((op) => op.group !== "native")) throw new PanelError("removed-settings", "Settings editing is not available in this extension.");
      const merged = new Map(expected.view.operations.map((op) => [key(op), op]));
      for (const op of updates) {
        if (op.kind === "set-chain" && isDeepStrictEqual(op.models,
          expected.baseline.view.routes.find((route) => route.kind === op.target && route.id === op.id)?.override)) {
          merged.delete(key(op));
        } else merged.set(key(op), op);
      }
      const ops = [...merged.values()];
      const edited = editDocument(expected.baseline.documents[expected.view.group], ops, expected.view.group);
      validate(ops, expected.baseline);
      const next = await prepare(expected.baseline, expected.view.group, ops, edited, null);
      buffer = next;
    }),
    undo: () => locked(async () => {
      if (buffer?.edited.nodes.length === 0) buffer = null;
      if (buffer) throw new PanelError("editing", "Apply or Cancel before undo.");
      const expected = current();
      journal = await loadUndo(stateDir, Object.values(expected.view.files));
      if (!journal) throw new PanelError("no-undo", "There is no successful Apply to undo.");
      if (journal.group === "settings") throw new PanelError("undo-unavailable", "The last save targets Settings, which this version no longer edits. Its undo record has been preserved.");
      const group = journal.group;
      const edited = undoDocument(expected.documents[group], journal);
      const restored = edited.nodes.flatMap((node): readonly Operation[] => {
        const field = Object.entries(fieldPaths[group]).find(([, path]) => isDeepStrictEqual(path, node.path))?.[0];
        return field === undefined ? [] : [node.after === undefined
          ? { kind: "remove-field", group, field }
          : { kind: "set-field", group, field, value: node.after }];
      });
      // Undo is another proposed save, not a bypass around field/model checks.
      editDocument(expected.documents[group], restored, group);
      validate(restored, expected);
      if (group === "native") {
        const references = edited.nodes.flatMap((node) => {
          if (node.path[1] !== "categories" && node.path[1] !== "agents") return [];
          if (!["model", "models", "fallback_models"].includes(node.path[3] ?? "") || node.after === undefined) return [];
          return (Array.isArray(node.after) ? node.after : [node.after]).flatMap((value) => {
            const model = typeof value === "string" ? value : record(value)["model"];
            return typeof model === "string" ? [model] : [];
          });
        });
        const ids = new Set(expected.view.catalog.models.map((model) => `${model.provider}/${model.id}`));
        const unresolved = [...new Set(references.filter((model) => !ids.has(model)))];
        if (unresolved.length) {
          const source = expected.view.inspection.files.find((file) => file.scope === "user");
          if (!source) throw new PanelError("source-missing", "The user source is missing.");
          const config = projectConfig(parseDocument(edited.text).value);
          const native = record(config["[native]"]);
          const checks = unresolved.map((model) => ({ id: `route-panel-undo-${randomUUID()}`, model }));
          // A unique custom category has no built-in ladder or project override.
          // The native oracle, not this editor, expands legacy aliases.
          const verified = await options.adapter.resolve({
            ...context(expected.view.scope), catalog: expected.view.catalog,
            candidate: { [source.sourceId]: {
              ...config, "[native]": { ...native, categories: {
                ...record(native["categories"]),
                ...Object.fromEntries(checks.map(({ id, model }) => [id, { models: [model] }])),
              } },
            } },
          });
          if (verified.status !== "ok" || !verified.value.candidate || checks.some(({ id }) => {
            const route = verified.value.candidate?.report.categories.find((entry) => entry.name === id);
            return !route || route.status !== "resolved" || !route.runtime.length || route.runtime.some((model) => !ids.has(model));
          })) throw new PanelError("unknown-model", "Undo would restore a model or legacy alias unavailable in the current host registry.");
        }
      }
      buffer = await prepare(expected, group, [], edited, journal);
    }),
    apply: () => locked(async (): Promise<SaveOutcome> => {
      const expected = buffer;
      if (!expected || !expected.edited.nodes.length) throw new PanelError("no-changes", "There are no changes to apply.");
      const count = new Set(expected.edited.nodes.map((node) => node.path.slice(0, 3).join("."))).size;
      const savedMessage = `Saved ${count} changes`;
      const expectedEpoch = epoch;
      await unchanged(expected.baseline, expectedEpoch);
      const writer = await undoWriter(stateDir);
      const publish = writer.publish;
      let previous: UndoRecord | null = null;
      let committed = false;
      try {
        previous = await loadUndo(stateDir, Object.values(expected.baseline.view.files));
        if (expected.undoRecord && !isDeepStrictEqual(previous, expected.undoRecord)) {
          throw new PanelError("undo-expired", "Another instance replaced or consumed this undo record. Cancel and refresh.");
        }
        await commitDocument(expected.baseline.documents[expected.view.group], expected.edited, expected.view.group, stateDir, {
          backup: async () => {
            const next: UndoRecord = { id: randomUUID(), group: expected.view.group, path: expected.view.path,
              beforeRevision: expected.baseline.documents[expected.view.group].revision,
              afterRevision: parseDocument(expected.edited.text).revision, nodes: expected.edited.nodes, created: expected.edited.created };
            journal = next;
            publish({ current: previous, pending: { journal: next, undo: expected.view.undo } });
          },
          beforeCommit: () => unchanged(expected.baseline, expectedEpoch),
          rename: async (from, to) => {
            alive(expectedEpoch);
            // Generation retirement cannot interleave this synchronous boundary.
            renameSync(from, to);
            committed = true;
            publish({ current: expected.view.undo ? null : journal });
          },
        });
      } catch (error) {
        if (!committed) { publish({ current: previous }); throw error; }
        buffer = null;
        baseline = null;
        const message = `${savedMessage}; post-save synchronization failed. Reopen Route Panel to inspect actual state.`;
        options.notifySave?.(message, "saved-reload-failed");
        return { status: "saved-reload-failed", message };
      } finally { await writer.close(); }
      buffer = null;
      baseline = null;
      options.notifySave?.(savedMessage, "saved");
      try { await options.reload(); }
      catch (error) {
        if (!(error instanceof Error)) throw error;
        const message = `${savedMessage}; reload failed. Reopen Route Panel to inspect actual state.`;
        options.notifySave?.(message, "saved-reload-failed");
        return { status: "saved-reload-failed", message };
      }
      return { status: "saved", message: savedMessage };
    }),
    cancel: () => { epoch++; buffer = null; },
    close: () => { ended = true; epoch++; buffer = null; baseline = null; },
  };
}
