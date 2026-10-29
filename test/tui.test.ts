import { test } from "node:test";
import assert from "node:assert/strict";
import { stripTerminalSequences, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { createPanelComponent } from "../src/tui.js";
import type { PanelController, PanelView, EditorView, SaveOutcome } from "../src/tui-contract.js";
import type { BackgroundRoute, Json, Operation, Route } from "../src/types.js";
import type { NativeInspection } from "../src/native/types.js";

const route: Route = {
  kind: "category", id: "quick", custom: false, status: "resolved", defaults: [{ model: "host/recommended" }],
  override: null, effective: [{ model: "host/old" }], selected: "host/old", evidence: [], diagnostics: [],
};
const inspection: NativeInspection = {
  engine: { version: "fixture", moduleDigest: "", nodeVersion: "", runtimeRoot: "", nodePath: "", nodeSourcePath: "", launcherPath: "", launcherSourcePath: "", launcherDigest: "" },
  home: "/synthetic", project: "/synthetic/project", files: [], watchPaths: [],
  settings: { globalPath: "/synthetic/settings", projectPath: "/synthetic/project/settings", projectInfluence: "unknown", pathStatus: "verified-global" },
};
const report = { categories: [], agents: [], excludeModels: [], modelProfile: {} };
const task = (id: string): BackgroundRoute => ({
  id, title: id === "sync" ? "Memory Sync" : id[0]?.toUpperCase() + id.slice(1), enabled: true,
  category: id === "recall" || id === "reflection" || id === "dream" ? "quick" : null,
  model: id === "facts" ? "identity/fixed" : null, policy: "Synthetic strategy", stateSource: "Identity override",
  modelStrategy: id === "nudge" || id === "sync" ? "local" : id === "facts" ? "fixed" : id === "recall" ? "category" : "dynamic",
  candidates: id === "recall" || id === "reflection" ? [{ model: "host/old" }] : [],
});
const view: PanelView = {
  scope: "user", registryContext: "/synthetic/registry", inspection,
  resolution: { inspection, catalogRevision: "1", equivalence: "equal", effective: { report, doctorLines: [] }, defaults: { report, doctorLines: [] } },
  catalog: { status: "ok", revision: "1", capturedAt: "2026-10-29", models: [{ provider: "extension", id: "vendor/raw/模型", name: "Long model" }, { provider: "host", id: "old" }] },
  routes: [route], background: ["recall", "reflection", "dream", "facts", "nudge", "sync"].map(task),
  fields: {}, files: { native: "/synthetic/native", settings: "/synthetic/settings" }, canUndo: true,
};
class SyntheticController implements PanelController {
  view: PanelView = view;
  editor: EditorView | null = null;
  applied = 0;
  canceled = 0;
  closed = 0;
  reads = 0;
  rejectChange = false;
  rejectApply = false;
  reloadFailed = false;
  applyGate: Promise<void> = Promise.resolve();
  async read(scope: "user" | "project"): Promise<void> { this.reads++; this.view = { ...this.view, scope }; }
  begin(group: "native" = "native"): void {
    this.editor = { group, path: this.view.files[group], operations: [], changes: [], routes: this.view.routes, background: this.view.background, fields: this.view.fields, modelProfile: {}, undo: false };
  }
  async change(operations: readonly Operation[]): Promise<void> {
    if (this.rejectChange) throw new Error("synthetic-resolution-failure");
    const editor = this.editor;
    assert.ok(editor);
    let routes = [...this.view.routes];
    const fields: Record<string, Json> = { ...this.view.fields };
    for (const op of operations) {
      switch (op.kind) {
        case "set-chain": {
          const existing = routes.find((item) => item.id === op.id && item.kind === op.target);
          const next: Route = { ...(existing ?? route), id: op.id, kind: op.target, override: op.models, effective: op.models };
          routes = [...routes.filter((item) => item.id !== op.id || item.kind !== op.target), next]; break;
        }
        case "set-field": fields[`native:${op.field}`] = op.value; break;
        case "remove-field": delete fields[`native:${op.field}`]; break;
        case "remove-override": routes = routes.map((item) => item.id === op.id ? { ...item, override: null, effective: item.defaults } : item); break;
      }
    }
    const changes = operations.flatMap((op) => {
      const field = op.kind === "set-field" || op.kind === "remove-field";
      const before = field ? this.view.fields[`native:${op.field}`] : this.view.routes.find((item) => item.id === op.id)?.override;
      const after = field ? fields[`native:${op.field}`] : routes.find((item) => item.id === op.id)?.override;
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{
        path: field ? `[native].${op.field}` : `[native].${op.target === "category" ? "categories" : "agents"}.${op.id}.models`,
        before: before === undefined ? "Inherit" : JSON.stringify(before), after: after === undefined ? "Inherit" : JSON.stringify(after),
      }];
    });
    this.editor = { ...editor, operations, fields, routes, changes };
  }
  async undo(): Promise<void> {
    this.begin();
    if (this.editor) this.editor = { ...this.editor, undo: true, changes: [{ path: "[native].model_profile", before: "a", after: "b" }] };
  }
  async apply(): Promise<SaveOutcome> {
    this.applied++; await this.applyGate;
    if (this.rejectApply) throw new Error("synthetic-conflict");
    if (this.editor) this.view = { ...this.view, routes: this.editor.routes, fields: this.editor.fields };
    this.editor = null; return this.reloadFailed
      ? { status: "saved-reload-failed", message: "Saved changes; reload failed" }
      : { status: "saved", message: "Saved changes" };
  }
  cancel(): void { this.canceled++; this.editor = null; }
  close(): void { this.closed++; }
}
function fixture() {
  const controller = new SyntheticController();
  const listeners = new Set<() => void>();
  let rows = 24;
  let width = 84;
  let done = 0;
  const component = createPanelComponent(controller, {
    rows: () => rows, hasProject: true, done: () => { done++; }, wrap: wrapTextWithAnsi,
    theme: { accent: (text) => `\u001b[35m${text}\u001b[0m` },
    requestRender: () => { for (const listener of listeners) listener(); },
  });
  const send = (...keys: readonly string[]): void => { for (const key of keys) component.handleInput(key); };
  const lines = (): string[] => component.render(width).map(stripTerminalSequences);
  const heading = (): string => (lines().find((line) => line.trim() && !/^-+$/.test(line)) ?? "").replace(/^-/, "").replace(/-+$/, "");
  const select = (label: string): void => {
    for (let i = 0; i < 100; i++) send("\u001b[A");
    for (let i = 0; i < 100; i++) {
      if (lines().some((line) => line.startsWith(`> ${label}`))) return;
      send("\u001b[B");
    }
    assert.fail(`Cannot select ${label}: ${lines().join("\n")}`);
  };
  const choose = (label: string): void => { select(label); send("\r"); };
  const action = async (trigger: () => void, ready: () => boolean): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { listeners.delete(check); reject(new Error(`No render event: ${lines().join("\n")}`)); }, 1000);
      const check = (): void => { if (ready()) { clearTimeout(timeout); listeners.delete(check); resolve(); } };
      listeners.add(check); trigger();
    });
  };
  const changed = (trigger: () => void): Promise<void> => {
    const before = controller.editor;
    return action(trigger, () => controller.editor !== before);
  };
  return { controller, component, send, select, choose, action, changed, lines, heading,
    resize: (columns: number, height: number) => { width = columns; rows = height; }, done: () => done };
}
const add = (f: ReturnType<typeof fixture>): void => {
  f.choose("Add candidate..."); f.send("vendor/raw", "\r");
};
const accept = (f: ReturnType<typeof fixture>): Promise<void> => f.changed(() => f.choose("Use chain"));

test("route entry opens directly and whole-chain acceptance preserves complete references", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f);
  // When
  assert.equal(f.controller.editor?.operations.length, 0);
  await accept(f);
  // Then
  assert.deepEqual(f.controller.editor?.operations, [{ kind: "set-chain", group: "native", target: "category", id: "quick",
    models: [{ model: "host/old" }, { model: "extension/vendor/raw/模型" }] }]);
  assert.equal(f.controller.applied, 0); f.component.dispose();
});
test("candidate reasoning and movement remain local until the complete form is accepted", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); f.send("\r"); f.choose("Reasoning"); f.choose("high");
  // When
  f.send("\r"); f.choose("Move earlier"); await accept(f);
  // Then
  const op = f.controller.editor?.operations[0]; assert.ok(op?.kind === "set-chain");
  assert.deepEqual(op.models, [{ model: "extension/vendor/raw/模型", reasoning: "high" }, { model: "host/old" }]);
  f.component.dispose();
});
test("rejected whole-chain validation retains the local form and accepted buffer", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f);
  const before = f.controller.editor; f.send("\r"); add(f); f.controller.rejectChange = true;
  // When
  await f.action(() => f.choose("Use chain"), () => f.lines().join("\n").includes("synthetic-resolution-failure"));
  // Then
  assert.equal(f.controller.editor, before); assert.equal(f.controller.applied, 0);
  f.controller.rejectChange = false; await accept(f); f.component.dispose();
});
test("main search owns printable commands, cursor edits, CJK and bracketed paste", () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, routes: [{ ...route, id: "甲eqa+r-乙" }] };
  // When
  f.send("\u001b[200~甲eqa+r-乙\u001b[201~", "\u001b[H", "\u001b[C", "\u001b[3~", "\u007f", "\u0015", "甲eqa+r-乙", "\r");
  // Then
  assert.ok(f.heading().includes("甲eqa+r-乙")); assert.equal(f.done(), 0); assert.equal(f.controller.applied, 0);
  f.component.dispose();
});
test("main Esc clears zero-result search before closing even on an action", () => {
  // Given
  const f = fixture(); f.send("no-match"); f.select("More...");
  // When
  f.send("\u001b");
  // Then
  assert.equal(f.done(), 0); assert.ok(f.lines().some((line) => line.startsWith("> quick")));
  f.send("\u001b"); assert.equal(f.done(), 1); f.component.dispose();
});
test("dirty search clear retains accepted changes and discard defaults to keep editing", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f); const before = f.controller.editor;
  // When
  f.send("no-match"); f.select("Changes"); f.send("\u001b", "\u001b", "\u001b");
  // Then
  assert.equal(f.controller.editor, before); assert.equal(f.done(), 0);
  f.send("\u001b"); f.choose("Discard & close"); assert.equal(f.done(), 1); assert.equal(f.controller.applied, 0); f.component.dispose();
});
test("picker cancellation restores immediate candidate menu without accepting input", () => {
  // Given
  const f = fixture(); f.send("\r", "\r"); f.choose("Replace model"); f.send("vendor");
  // When
  f.send("\u001b");
  // Then
  assert.ok(f.heading().includes("Candidate 1")); assert.equal(f.controller.editor?.operations.length, 0);
  f.send("\u001b"); f.select("Add candidate..."); f.component.dispose();
});
test("Ctrl-U clears picker search while Esc cancels it immediately", () => {
  // Given
  const f = fixture(); f.send("\r"); f.choose("Add candidate..."); f.send("none");
  // When
  f.send("\u0015");
  // Then
  assert.ok(f.lines().some((line) => line.includes("extension/vendor/raw/模型"))); f.send("\u001b"); assert.ok(f.heading().includes("quick"));
  f.component.dispose();
});
test("background fields accept immediately and Esc keeps accepted choices", async () => {
  // Given
  const f = fixture(); f.send("\t", "\r"); f.choose("Enabled");
  // When
  await f.changed(() => f.choose("Disabled")); f.send("\u001b");
  // Then
  assert.deepEqual(f.controller.editor?.operations, [{ kind: "set-field", group: "native", field: "memory.recall.enabled", value: false }]);
  assert.equal(f.controller.applied, 0); f.component.dispose();
});
test("background Space toggles effective switch only inside task field list", async () => {
  // Given
  const f = fixture(); f.send("\t", "\r");
  // When
  await f.changed(() => f.send(" "));
  // Then
  assert.deepEqual(f.controller.editor?.operations[0], { kind: "set-field", group: "native", field: "memory.recall.enabled", value: false });
  f.send("\u001b"); f.component.dispose();
});
test("category inheritance removes the user leaf and retains task field focus", async () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, fields: { "native:memory.recall.category": "quick" } };
  f.send("\t", "\r"); f.choose("Category");
  // When
  await f.changed(() => f.choose("Inherit"));
  // Then
  assert.deepEqual(f.controller.editor?.operations[0], { kind: "remove-field", group: "native", field: "memory.recall.category" });
  assert.ok(f.lines().some((line) => line.startsWith("> Category"))); f.component.dispose();
});
test("Facts model selector highlights user declaration instead of shadowing identity model", async () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, fields: { "native:memory.facts.model": "host/old" },
    background: view.background.map((item) => item.id === "facts" ? { ...item, bindingSource: "identity-source-token", stateSource: "switch-source-token" } : item) };
  f.send("\t"); f.choose("Facts"); f.select("Model");
  assert.ok(f.lines().some((line) => line.includes("identity-source-token")));
  assert.ok(f.lines().some((line) => line.includes("identity/fixed")));
  assert.ok(!f.lines().some((line) => line.includes("switch-source-token")));
  f.choose("Model");
  assert.ok(f.lines().some((line) => line.startsWith("> host/old"))); f.send("vendor");
  // When
  await f.changed(() => f.send("\r"));
  // Then
  assert.deepEqual(f.controller.editor?.operations[0], { kind: "set-field", group: "native", field: "memory.facts.model", value: "extension/vendor/raw/模型" });
  assert.equal(f.controller.editor?.background.find((item) => item.id === "facts")?.model, "identity/fixed"); f.component.dispose();
});
test("read-only local tasks have no editable or model candidate controls", () => {
  // Given
  const f = fixture(); f.send("\t"); f.choose("Nudge");
  // When
  f.send(" ", "\r");
  // Then
  assert.equal(f.controller.editor, null); assert.equal(f.controller.applied, 0); f.component.dispose();
});
test("model profile selection accepts immediately without a separate Done step", async () => {
  // Given
  const f = fixture(); f.choose("Model profile");
  // When
  await f.changed(() => { f.send("\u001b[B", "\r"); });
  // Then
  assert.equal(f.controller.editor?.operations[0]?.kind, "set-field");
  assert.ok(f.heading().startsWith("Routing")); f.component.dispose();
});
test("duplicate new category checks all routes independently of filtering", () => {
  // Given
  const f = fixture(); f.send("hidden"); f.choose("Add category..."); f.send("quick");
  // When
  f.send("\r"); f.choose("Locate category");
  // Then
  assert.equal(f.controller.editor?.operations.length, 0); assert.ok(f.lines().some((line) => line.startsWith("> quick")));
  f.component.dispose();
});
test("new category is not accepted until name and first model are valid", async () => {
  // Given
  const f = fixture(); f.choose("Add category..."); f.send("custom", "\r"); f.send("vendor/raw");
  // When
  await f.changed(() => f.send("\r"));
  // Then
  assert.deepEqual(f.controller.editor?.operations[0], { kind: "set-chain", group: "native", target: "category", id: "custom", models: [{ model: "extension/vendor/raw/模型" }] });
  f.component.dispose();
});
test("local chain cancellation retains accepted edits from another entry", async () => {
  // Given
  const f = fixture(); f.choose("Model profile"); await f.changed(() => f.send("\u001b[B", "\r"));
  const before = f.controller.editor; f.select("quick"); f.send("\r"); add(f);
  // When
  f.send("\u001b");
  // Then
  assert.equal(f.controller.editor, before); assert.equal(f.controller.applied, 0); f.component.dispose();
});
test("clean opened editor does not lock refresh or scope changes", async () => {
  // Given
  const f = fixture(); f.send("\r", "\u001b"); f.choose("More..."); f.choose("Refresh");
  // When
  await f.action(() => f.component.invalidate(), () => f.controller.reads === 1);
  // Then
  assert.equal(f.controller.editor, null); f.choose("More..."); f.choose("Change scope");
  await f.action(() => f.choose("Current project"), () => f.controller.view.scope === "project");
  f.component.dispose();
});
test("scope changes cannot discard accepted changes", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f); const before = f.controller.editor;
  // When
  f.choose("More..."); f.choose("Change scope");
  // Then
  assert.equal(f.controller.editor, before); assert.equal(f.controller.reads, 0); f.component.dispose();
});
test("Ctrl-S blocks local input and redirects accepted child state to changes", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f);
  // When
  f.send("\u0013"); assert.equal(f.controller.applied, 0); await accept(f);
  f.send("\r", "\u0013");
  // Then
  assert.equal(f.controller.applied, 0); assert.ok(f.heading().startsWith("Changes")); f.component.dispose();
});
test("double Apply is locked while commit is pending", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f);
  let release: (() => void) | undefined; f.controller.applyGate = new Promise<void>((resolve) => { release = resolve; });
  // When
  f.send("\u0013", "\u0013", "s");
  // Then
  assert.equal(f.controller.applied, 1); await f.action(() => release?.(), () => f.controller.editor === null);
  assert.equal(f.controller.applied, 1); f.component.dispose();
});
test("precommit conflict retains dirty buffer through navigation", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f); const before = f.controller.editor; f.controller.rejectApply = true;
  // When
  await f.action(() => f.send("\u0013"), () => f.lines().join("\n").includes("synthetic-conflict"));
  f.send("\t", "\t");
  // Then
  assert.equal(f.controller.editor, before); assert.ok(f.lines().join("\n").includes("synthetic-conflict")); f.component.dispose();
});
test("undo uses integrated changes and requires explicit Apply", async () => {
  // Given
  const f = fixture();
  // When
  await f.action(() => f.choose("Undo last save"), () => f.controller.editor?.undo === true);
  // Then
  assert.equal(f.controller.applied, 0); assert.ok(f.heading().startsWith("Changes"));
  await f.action(() => f.send("\u0013"), () => f.controller.editor === null); f.component.dispose();
});
test("comparison keeps saved baseline separate from accepted proposed chain", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f); f.send("\r"); f.choose("Compare recommendation");
  // When
  assert.ok(f.lines().join("\n").includes("extension/vendor/raw/模型")); f.send("\u001b[C");
  // Then
  assert.ok(!f.lines().join("\n").includes("extension/vendor/raw/模型")); assert.ok(f.lines().join("\n").includes("host/old"));
  f.send("\u001b[D", "\u001b[D"); assert.ok(f.lines().join("\n").includes("extension/vendor/raw/模型")); f.component.dispose();
});
test("resize and paged details preserve complete CJK references and buffer", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f); const editor = f.controller.editor;
  f.send("\r"); f.choose("Compare recommendation"); f.resize(18, 8);
  // When
  const screens: string[] = [];
  for (let i = 0; i < 30; i++) {
    const lines = f.lines(); assert.ok(lines.length <= 8); assert.ok(lines.every((line) => visibleWidth(line) <= 18));
    screens.push(lines.join("")); f.send("\u001b[6~");
  }
  // Then
  assert.ok(screens.join("").includes("extension/vendor/raw/模型")); assert.equal(f.controller.editor, editor); f.component.dispose();
});
test("section search and selection survive Tab and child cancellation", () => {
  // Given
  const f = fixture(); f.send("quick", "\t", "facts", "\t");
  // When
  f.send("\r", "\u001b");
  // Then
  assert.ok(f.lines().some((line) => line.startsWith("> quick")));
  f.send("\t"); assert.ok(f.lines().some((line) => line.startsWith("> Facts"))); f.component.dispose();
});
test("compact layout keeps focus and reachable actions at every required size", () => {
  // Given
  const f = fixture();
  // When
  for (const [width, height] of [[120, 40], [70, 24], [40, 12], [18, 8]]) {
    f.resize(width ?? 18, height ?? 8); f.select("More..."); const lines = f.lines();
    // Then
    assert.ok(lines.length <= Math.min(height ?? 8, 20)); assert.ok(lines.every((line) => visibleWidth(line) <= Math.min(width ?? 18, 84)));
    assert.ok(lines.some((line) => line.startsWith("> More...")));
  }
  f.component.dispose();
});
test("close and dispose cancel without applying or duplicate teardown", () => {
  // Given
  const f = fixture(); f.send("\r", "\u001b");
  // When
  f.send("\u0003"); f.component.dispose();
  // Then
  assert.equal(f.controller.editor, null); assert.equal(f.controller.applied, 0); assert.equal(f.controller.closed, 1); assert.equal(f.done(), 1);
});

test("two unavailable candidates can be repaired locally before one validation", async () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, routes: [{ ...route,
    override: [{ model: "legacy-one" }, { model: "legacy-two", reasoning: "high" }],
    effective: [], status: "unavailable" }] };
  f.send("\r", "\r"); f.choose("Replace model"); f.send("host/old", "\r");
  f.select("2  legacy-two"); f.send("\r"); f.choose("Replace model"); f.send("vendor/raw", "\r");
  assert.equal(f.controller.editor?.operations.length, 0);
  // When
  await accept(f);
  // Then
  const op = f.controller.editor?.operations[0]; assert.ok(op?.kind === "set-chain");
  assert.deepEqual(op.models, [{ model: "host/old" }, { model: "extension/vendor/raw/模型", reasoning: "high" }]);
  f.component.dispose();
});
test("reasoning Inherit omits candidate declaration rather than materializing route reasoning", async () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, routes: [{ ...route, override: [{ model: "host/old", reasoning: "high" }],
    routeReasoning: { reasoning: "low", reasoningEffort: "medium", variant: "saved" } }] };
  f.send("\r", "\r"); f.choose("Reasoning");
  // When
  f.choose("Inherit"); await accept(f);
  // Then
  const op = f.controller.editor?.operations[0]; assert.ok(op?.kind === "set-chain");
  assert.deepEqual(op.models, [{ model: "host/old" }]); f.component.dispose();
});
test("restoring chain inheritance remains local until Use chain", async () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, routes: [{ ...route, override: [{ model: "host/old" }] }] };
  f.send("\r"); f.choose("Restore chain inheritance"); assert.equal(f.controller.editor?.operations.length, 0);
  // When
  await accept(f);
  // Then
  assert.deepEqual(f.controller.editor?.operations[0], { kind: "remove-override", group: "native", target: "category", id: "quick" });
  f.component.dispose();
});
test("final candidate removal is unavailable and cannot create an empty chain", () => {
  // Given
  const f = fixture(); f.send("\r", "\r");
  // When
  f.choose("Remove");
  // Then
  assert.equal(f.controller.editor?.operations.length, 0); f.send("\u001b"); f.select("1  host/old"); f.component.dispose();
});
test("local reorder revert restores comparison and accepted-buffer return access", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f); f.send("\r", "\r"); f.choose("Move later");
  f.choose("Compare recommendation"); assert.ok(!f.heading().includes("Compare"));
  // When
  f.select("2  host/old"); f.send("\r"); f.choose("Move earlier"); f.choose("Compare recommendation");
  // Then
  assert.ok(f.heading().includes("Compare")); f.component.dispose();
});
test("reverting a user field to saved declaration clears dirty Apply state", async () => {
  // Given
  const f = fixture(); f.send("\t", "\r"); f.choose("Enabled"); await f.changed(() => f.choose("Disabled"));
  f.choose("Enabled");
  // When
  await f.changed(() => f.choose("Inherit")); f.send("\u001b", "\u001b");
  // Then
  assert.equal(f.controller.editor?.changes.length ?? 0, 0); assert.equal(f.done(), 1); f.component.dispose();
});
test("failed field acceptance returns to the affected field without replacing accepted state", async () => {
  // Given
  const f = fixture(); f.send("\t", "\r"); f.choose("Enabled"); f.controller.rejectChange = true;
  const before = f.controller.editor;
  // When
  await f.action(() => f.choose("Disabled"), () => f.lines().join("\n").includes("synthetic-resolution-failure"));
  // Then
  assert.equal(f.controller.editor, before); assert.ok(f.lines().some((line) => line.startsWith("> Enabled"))); f.component.dispose();
});
test("accepted new categories also participate in duplicate-name detection", async () => {
  // Given
  const f = fixture(); f.choose("Add category..."); f.send("custom", "\r", "host/old");
  await f.changed(() => f.send("\r")); const before = f.controller.editor; f.send("hidden"); f.choose("Add category..."); f.send("custom");
  // When
  f.send("\r"); f.choose("Locate category");
  // Then
  assert.equal(f.controller.editor, before); assert.ok(f.lines().some((line) => line.startsWith("> custom"))); f.component.dispose();
});
test("pending chain disables comparison without altering another accepted entry", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f); const before = f.controller.editor; f.send("\r"); add(f);
  // When
  f.choose("Compare recommendation"); f.choose("Back to changes"); f.send("\u0013");
  // Then
  assert.equal(f.controller.editor, before); assert.equal(f.controller.applied, 0); assert.ok(!f.heading().startsWith("Changes")); f.component.dispose();
});
test("small model picker pages complete long references without losing selectable focus", async () => {
  // Given
  const f = fixture(); const reference = `provider/${"模型".repeat(30)}/raw`;
  f.controller.view = { ...view, catalog: { ...view.catalog, models: [{ provider: "provider", id: `${"模型".repeat(30)}/raw` }] } };
  f.send("\r"); f.choose("Add candidate..."); f.resize(18, 8);
  // When
  const screens: string[] = [];
  for (let i = 0; i < 20; i++) { screens.push(f.lines().join("")); f.send("\u001b[6~"); }
  f.send("\r");
  // Then
  assert.ok(screens.join("").includes("provider/")); assert.ok(screens.join("").includes("/raw"));
  f.resize(84, 24); await accept(f);
  const op = f.controller.editor?.operations[0]; assert.ok(op?.kind === "set-chain"); assert.equal(op.models[1]?.model, reference);
  f.component.dispose();
});

test("saved reload failure clears accepted changes and Reopen reads actual state for Undo", async () => {
  // Given
  const f = fixture(); f.controller.reloadFailed = true; f.send("\r"); add(f); await accept(f);
  await f.action(() => f.send("\u0013"), () => f.controller.editor === null);
  f.choose("More...");
  // When
  await f.action(() => f.choose("Reopen"), () => f.controller.reads === 1);
  // Then
  assert.equal(f.controller.applied, 1); assert.equal(f.controller.editor, null); f.select("Undo last save"); f.component.dispose();
});

test("narrow task selection preserves full field label without reescaping host ANSI", () => {
  // Given
  const f = fixture(); f.send("\t", "\r"); f.resize(18, 8);
  // When
  f.select("Category");
  // Then
  assert.ok(f.lines().some((line) => line.startsWith("> Category")));
  assert.ok(f.lines().every((line) => visibleWidth(line) <= 18 && !line.includes("\\u001b")));
  f.component.dispose();
});

test("route-level reasoning details retain local-pending Ctrl-S protection", async () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, routes: [{ ...route, routeReasoning: { variant: "raw-route-variant" } }] };
  f.send("\r"); add(f); await accept(f); f.send("\r"); add(f); f.choose("Route reasoning declarations...");
  // When
  f.send("\u0013");
  // Then
  assert.equal(f.controller.applied, 0); assert.ok(f.lines().join("\n").includes("raw-route-variant")); f.component.dispose();
});
test("restore on already inherited chain remains unchanged and does not accept a write", () => {
  // Given
  const f = fixture(); f.send("\r");
  // When
  f.choose("Restore chain inheritance"); f.choose("Use chain");
  // Then
  assert.equal(f.controller.editor?.operations.length, 0); assert.equal(f.controller.applied, 0); f.component.dispose();
});
test("unavailable saved Facts declaration stays selected and cannot be mistaken for Inherit", () => {
  // Given
  const f = fixture(); f.controller.view = { ...view, fields: { "native:memory.facts.model": "saved/legacy" } };
  f.send("\t"); f.choose("Facts");
  // When
  f.choose("Model"); f.send("\r");
  // Then
  assert.ok(f.lines().some((line) => line.startsWith("> saved/legacy")));
  assert.equal(f.controller.editor?.operations.length, 0); f.component.dispose();
});

test("changes compact JSONC node declarations without escaping formatting as model text", () => {
  // Given
  const f = fixture(); f.controller.begin();
  const editor = f.controller.editor; assert.ok(editor);
  f.controller.editor = { ...editor, changes: [{ path: "[native].categories.quick.models",
    before: '[\n // preserved declaration comment\n {"model":"host/old"}\n]',
    after: '[\n {"model":"extension/vendor/raw/模型","reasoning":"high"}\n]' }] };
  // When
  f.choose("Changes");
  // Then
  const output = f.lines().join("\n");
  assert.ok(output.includes('"model":"extension/vendor/raw/模型"'));
  assert.ok(!output.includes("\\u000a"));
  assert.ok(!output.includes("preserved declaration comment"));
  f.component.dispose();
});

test("pasted and chunked command names remain text even with accepted changes", async () => {
  // Given
  const f = fixture(); f.send("\r"); add(f); await accept(f);
  const before = f.controller.editor;
  // When / Then
  for (const word of ["apply", "tab", "close", "more", "changes", "escape", "enter", "up", "down", "left", "right", "home", "end", "clear", "delete", "backspace", "pageup", "pagedown"]) {
    for (const data of [`\u001b[200~${word}\u001b[201~`, word]) {
      f.send("\u0015", data);
      assert.ok(f.lines().some((line) => line === `> ${word}|`));
      assert.ok(f.heading().includes("[Routes]"));
      assert.equal(f.controller.editor, before);
      assert.equal(f.controller.applied, 0); assert.equal(f.done(), 0);
    }
  }
  f.send("\u0015"); f.choose("Add category..."); f.send("\u001b[200~enter\u001b[201~");
  assert.ok(f.lines().some((line) => line === "> enter|"));
  assert.equal(f.controller.editor, before);
  f.component.dispose();
});

test("pasted Space cannot toggle a background switch but the physical Space key can", async () => {
  // Given
  const f = fixture(); f.send("\t"); f.choose("Recall");
  // When
  f.send("\u001b[200~ \u001b[201~");
  // Then
  const pasted = f.controller.editor;
  assert.equal(pasted, null);
  await f.changed(() => f.send(" "));
  assert.equal(f.controller.editor?.fields["native:memory.recall.enabled"], false);
  f.component.dispose();
});

test("all active views share bounded top and bottom rules without losing small-screen controls", async () => {
  for (const [width, height] of [[84, 24], [70, 22], [40, 10], [18, 6]] as const) {
    const f = fixture(); f.resize(width, height);
    const framed = (): void => {
      const lines = f.lines();
      const visible = lines.filter((line) => line.length > 0);
      assert.ok(lines.length <= Math.min(20, height));
      assert.ok(lines.every((line) => visibleWidth(line) <= Math.min(84, width)));
      for (const edge of [visible[0], visible.at(-1)]) {
        assert.ok(edge !== undefined);
        assert.ok(edge.startsWith("-") && edge.endsWith("-"));
        assert.equal(visibleWidth(edge), Math.min(84, width));
      }
    };
    framed();
    f.send("\r"); framed();
    f.send("\r"); framed();
    f.choose("Replace model"); framed();
    f.send("\u001b", "\u001b");
    f.choose("Compare"); framed();
    f.send("\r"); framed();
    f.send("\u001b", "\u001b", "\u001b");
    f.choose("Add category..."); framed();
    f.send("bad name", "\r"); framed();
    f.send("\u001b", "\t", "\r"); framed();
    f.send("\r"); framed();
    f.send("\u001b", "\u001b", "\t"); f.select("quick"); f.send("\r");
    add(f); await accept(f); framed();
    f.choose("Changes"); framed();
    f.send("\u001b", "\u001b"); framed();
    assert.ok(f.lines().some((line) => line.startsWith("> Keep editing")));
    f.send("\u001b");
    f.controller.rejectApply = true;
    await f.action(() => f.send("\u0013"), () => f.lines().some((line) => line.includes("synthetic")));
    framed();
    assert.ok(f.lines().some((line) => line.startsWith("> Changes")));
    f.component.dispose();
  }
});
