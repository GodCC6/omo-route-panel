import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createPanelController } from "../src/editor.js";
import { nodeValue, readDocument } from "../src/config.js";
import { undoWriter } from "../src/undo.js";
import { fixture, models } from "./native-fixture.js";
import type { NativeAdapter } from "../src/native/index.js";
import type { Operation } from "../src/types.js";

const changes: readonly Operation[] = [
  { kind: "set-field", group: "native", field: "memory.recall.enabled", value: false },
  { kind: "set-field", group: "native", field: "memory.facts.model", value: "fixture/two" },
  { kind: "set-field", group: "native", field: "memory.dream.enabled", value: false },
];

async function setup(t: { after(fn: () => Promise<void>): void }) {
  const f = await fixture(t);
  const nativePath = await f.config(f.home, { other: 9 });
  await writeFile(nativePath, '{\n// keep comment\n"other":9\n}\n', { mode: 0o600 });
  const agentDir = join(f.home, ".omo", "agent");
  await mkdir(agentDir, { recursive: true });
  const path = join(agentDir, "settings.json");
  await writeFile(path, '{\n// keep comment\n"defaultProvider":"fixture","defaultModel":"one","other":9\n}\n', { mode: 0o600 });
  let catalogFailure = false;
  const adapter: NativeAdapter = { ...f.adapter, catalog: async () =>
    catalogFailure ? { status: "unknown", code: "synthetic-catalog-failed" } : models };
  const signal = new AbortController();
  let reloads = 0;
  const controller = () => createPanelController({
    home: f.home, project: f.project, registryContext: f.project, adapter, signal: signal.signal,
    reload: async () => { reloads++; },
  });
  return { ...f, path: nativePath, settingsPath: path, signal, controller, failCatalog: () => { catalogFailure = true; }, reloads: () => reloads };
}

test("multiple native entries change together only at explicit Apply and survive reopening for undo", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  const before = await readFile(f.path, "utf8");
  await panel.change(changes.slice(0, 2));
  await panel.change(changes.slice(2));
  assert.equal(await readFile(f.path, "utf8"), before);
  assert.equal(panel.editor?.changes.length, 3);
  // When
  const outcome = await panel.apply();
  // Then
  assert.equal(outcome.status, "saved");
  assert.equal(f.reloads(), 1);
  const saved = await readDocument(f.path);
  assert.equal(nodeValue(saved, ["[native]", "memory", "facts", "model"]), "fixture/two");
  assert.equal(nodeValue(saved, ["[native]", "memory", "dream", "enabled"]), false);
  assert.equal(nodeValue(saved, ["other"]), 9);
  assert.match(saved.text, /\/\/ keep comment/);
  const reopened = f.controller();
  await reopened.read("user");
  assert.equal(reopened.view?.canUndo, true);
  await reopened.undo();
  assert.equal(reopened.editor?.undo, true);
});

test("Cancel clears the whole buffer without writing or persisting a recoverable edit", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  const before = await readFile(f.path, "utf8");
  await panel.change(changes);
  // When
  panel.cancel();
  // Then
  assert.equal(panel.editor, null);
  assert.equal(await readFile(f.path, "utf8"), before);
  const reopened = f.controller();
  await reopened.read("user");
  assert.equal(reopened.editor, null);
  assert.equal(reopened.view?.canUndo, false);
});

test("external edit refuses Apply without overwriting the external version", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  const external = '{"other":17}\n';
  await writeFile(f.path, external, { mode: 0o600 });
  // When / Then
  await assert.rejects(panel.apply(), { code: "conflict" });
  assert.equal(await readFile(f.path, "utf8"), external);
});

test("undo after reopen preserves unrelated external edits and consumes its record", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  await panel.apply();
  await writeFile(f.path, (await readFile(f.path, "utf8")).replace(/"other"\s*:\s*9/, '"other":27'), { mode: 0o600 });
  const reopened = f.controller();
  await reopened.read("user");
  await reopened.undo();
  // When
  await reopened.apply();
  // Then
  const saved = await readDocument(f.path);
  assert.equal(nodeValue(saved, ["[native]", "memory", "facts", "model"]), undefined);
  assert.equal(nodeValue(saved, ["[native]", "memory", "dream", "enabled"]), undefined);
  assert.equal(nodeValue(saved, ["other"]), 27);
  const final = f.controller();
  await final.read("user");
  assert.equal(final.view?.canUndo, false);
});

test("undo rejects a relevant external edit after reopen", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  await panel.apply();
  await writeFile(f.path, (await readFile(f.path, "utf8")).replace('"fixture/two"', '"fixture/changed"'), { mode: 0o600 });
  const reopened = f.controller();
  await reopened.read("user");
  // When / Then
  await assert.rejects(reopened.undo(), { code: "undo-conflict" });
});

test("closed generations cannot apply a previously inspected buffer", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  const before = await readFile(f.path, "utf8");
  // When
  panel.close();
  // Then
  await assert.rejects(panel.apply(), { code: "editor-ended" });
  assert.equal(await readFile(f.path, "utf8"), before);
});

test("scope and file switches cannot create hidden concurrent buffers", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  // When / Then
  await assert.rejects(panel.read("project"), { code: "editing" });
  assert.throws(() => panel.begin("native"), { code: "editing" });
  assert.equal(panel.editor?.group, "native");
  assert.equal(panel.editor?.changes.length, 3);
});

test("failed host availability is a failure and cannot authorize Apply", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  f.failCatalog();
  // When / Then
  await assert.rejects(panel.apply(), { code: "catalog-changed" });
  assert.equal(nodeValue(await readDocument(f.path), ["[native]", "memory", "facts", "model"]), undefined);
});

test("a saved configuration remains saved when host reload fails", async (t) => {
  // Given
  const f = await setup(t);
  const source = f.controller();
  await source.read("user");
  assert.ok(source.view);
  const panel = createPanelController({
    home: f.home, project: f.project, registryContext: f.project,
    adapter: { ...f.adapter, catalog: async () => models },
    signal: f.signal.signal, reload: async () => { throw new Error("synthetic reload failure"); },
  });
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  // When
  const outcome = await panel.apply();
  // Then
  assert.equal(outcome.status, "saved-reload-failed");
  assert.equal(nodeValue(await readDocument(f.path), ["[native]", "memory", "facts", "model"]), "fixture/two");
  assert.equal(panel.editor, null);
});

test("a duplicate Apply cannot submit a second write while the first is in flight", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  // When
  const first = panel.apply();
  await assert.rejects(panel.apply(), { code: "busy" });
  await first;
  // Then
  assert.equal(f.reloads(), 1);
  assert.equal(nodeValue(await readDocument(f.path), ["[native]", "memory", "facts", "model"]), "fixture/two");
});

test("background implementation changes invalidate an inspected edit before Apply", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin("native");
  await panel.change(changes);
  const root = join(f.home, "synthetic-contract", "plugin", "extensions");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "omo.js"), "// synthetic changed semantic artifact");
  // When / Then
  await assert.rejects(panel.apply(), { code: "context-changed" });
  assert.equal(nodeValue(await readDocument(f.path), ["[native]", "memory", "facts", "model"]), undefined);
});

for (const invalid of ["model", "profile"] as const) {
  test(`undo cannot restore a native ${invalid} value rejected by current save validation`, async (t) => {
    // Given
    const f = await setup(t);
    const original = invalid === "model"
      ? '{"[native]":{"memory":{"facts":{"model":"fixture/removed-model"}}}}'
      : '{"[native]":{"model_profile":"removed-profile"}}';
    await writeFile(f.path, original, { mode: 0o600 });
    const panel = f.controller();
    await panel.read("user");
    panel.begin("native");
    await panel.change(invalid === "model" ? changes : [{ kind: "remove-field", group: "native", field: "model_profile" }]);
    await panel.apply();
    const saved = await readFile(f.path, "utf8");
    const reopened = f.controller();
    await reopened.read("user");
    // When / Then
    await assert.rejects(reopened.undo(), { code: invalid === "model" ? "unknown-model" : "unknown-profile" });
    assert.equal(await readFile(f.path, "utf8"), saved);
    assert.equal(reopened.view?.canUndo, true);
  });
}

test("a prepared undo expires after another instance consumes a newer record even when file bytes return", async (t) => {
  // Given
  const f = await setup(t);
  await writeFile(f.path, '{"[native]":{"memory":{"facts":{"model":"fixture/one"},"dream":{"enabled":true}}}}', { mode: 0o600 });
  const first = f.controller();
  await first.read("user");
  first.begin("native");
  await first.change([{ kind: "set-field", group: "native", field: "memory.facts.model", value: "fixture/two" }]);
  await first.apply();
  const pending = f.controller();
  await pending.read("user");
  await pending.undo();
  const inspectedRevision = (await readDocument(f.path)).revision;
  const second = f.controller();
  await second.read("user");
  second.begin("native");
  await second.change([{ kind: "set-field", group: "native", field: "memory.dream.enabled", value: false }]);
  await second.apply();
  const latest = f.controller();
  await latest.read("user");
  await latest.undo();
  await latest.apply();
  assert.equal((await readDocument(f.path)).revision, inspectedRevision);
  // When / Then
  await assert.rejects(pending.apply(), { code: "undo-expired" });
  assert.equal(nodeValue(await readDocument(f.path), ["[native]", "memory", "facts", "model"]), "fixture/two");
  const reopened = f.controller();
  await reopened.read("user");
  assert.equal(reopened.view?.canUndo, false);
});

test("removed Settings entry points reject writes without altering the native buffer", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  const before = await readFile(f.settingsPath, "utf8");
  // When / Then
  assert.throws(() => Reflect.apply(panel.begin, panel, ["settings"]), { code: "removed-settings" });
  assert.equal(panel.editor, null);
  panel.begin();
  await panel.change(changes);
  const accepted = panel.editor;
  for (const field of ["defaultProvider", "defaultModel", "defaultThinkingLevel", "compaction.model"]) {
    await assert.rejects(panel.change([{ kind: "set-field", group: "settings", field, value: "fixture/two" }]), { code: "removed-settings" });
    await assert.rejects(panel.change([{ kind: "remove-field", group: "settings", field }]), { code: "removed-settings" });
    assert.equal(panel.editor, accepted);
  }
  assert.equal(await readFile(f.settingsPath, "utf8"), before);
});

test("Settings remains a hashed dependency of native Apply", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  assert.equal(panel.view?.fields["settings:defaultModel"], "one");
  panel.begin();
  await panel.change(changes);
  const nativeBefore = await readFile(f.path, "utf8");
  const accepted = panel.editor;
  const external = '{"defaultProvider":"fixture","defaultModel":"two"}\n';
  await writeFile(f.settingsPath, external, { mode: 0o600 });
  // When / Then
  await assert.rejects(panel.apply(), { code: "conflict" });
  assert.equal(await readFile(f.path, "utf8"), nativeBefore);
  assert.equal(await readFile(f.settingsPath, "utf8"), external);
  assert.equal(panel.editor, accepted);
});

test("legacy Settings undo is unavailable and preserves its record and target", async (t) => {
  // Given
  const f = await setup(t);
  const stateDir = join(f.home, ".local", "state", "omo-route-panel", "tui");
  const saved = await readDocument(f.settingsPath);
  const writer = await undoWriter(stateDir);
  writer.publish({ current: {
    id: "legacy-settings", group: "settings", path: f.settingsPath,
    beforeRevision: "old", afterRevision: saved.revision, created: [],
    nodes: [{ path: ["defaultModel"], before: "two", after: "one" }],
  } });
  await writer.close();
  const journalPath = join(stateDir, "latest.json");
  const journal = await readFile(journalPath, "utf8");
  const panel = f.controller();
  await panel.read("user");
  assert.equal(panel.view?.canUndo, false);
  assert.equal(typeof panel.view?.undoUnavailableReason, "string");
  // When / Then
  await assert.rejects(panel.undo(), { code: "undo-unavailable" });
  assert.equal(panel.editor, null);
  assert.equal(await readFile(f.settingsPath, "utf8"), saved.text);
  assert.equal(await readFile(journalPath, "utf8"), journal);
});

test("opening and reverting clean native buffers permit refresh and scope changes", async (t) => {
  // Given
  const f = await setup(t);
  const panel = f.controller();
  await panel.read("user");
  panel.begin();
  await panel.read("project");
  assert.equal(Boolean(panel.editor), false);
  panel.begin();
  await panel.change(changes);
  await panel.change(changes.flatMap((op): readonly Operation[] =>
    op.kind === "set-field" ? [{ kind: "remove-field", group: "native", field: op.field }] : []));
  assert.equal(panel.editor?.changes.length, 0);
  const before = await readFile(f.path, "utf8");
  // When
  await panel.read("user");
  // Then
  assert.equal(panel.editor, null);
  assert.equal(panel.view?.scope, "user");
  assert.equal(await readFile(f.path, "utf8"), before);
});

for (const reloadFails of [false, true]) {
  test(`committed save notification precedes ${reloadFails ? "failed" : "successful"} host reload`, async (t) => {
    // Given
    const f = await setup(t);
    const before = await readFile(f.path, "utf8");
    const events: string[] = [];
    const panel = createPanelController({
      home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter,
      signal: f.signal.signal,
      notifySave: (_message, status) => {
        assert.notEqual(readFileSync(f.path, "utf8"), before);
        assert.equal(panel.editor, null);
        events.push(status);
      },
      reload: async () => {
        events.push("reload");
        panel.close();
        if (reloadFails) throw new Error("synthetic reload failure");
      },
    });
    await panel.read("user");
    panel.begin();
    await panel.change(changes);
    assert.deepEqual(events, []);
    // When
    const result = await panel.apply();
    // Then
    assert.equal(result.status, reloadFails ? "saved-reload-failed" : "saved");
    assert.deepEqual(events, reloadFails ? ["saved", "reload", "saved-reload-failed"] : ["saved", "reload"]);
    const reopened = f.controller();
    await reopened.read("user");
    assert.equal(reopened.view?.canUndo, true);
  });
}

test("precommit failure retains the buffer and does not publish a save notification", async (t) => {
  // Given
  const f = await setup(t);
  const events: string[] = [];
  const panel = createPanelController({
    home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter,
    signal: f.signal.signal, notifySave: (_message, status) => { events.push(status); },
    reload: async () => { events.push("reload"); },
  });
  await panel.read("user");
  panel.begin();
  await panel.change(changes);
  const accepted = panel.editor;
  await writeFile(f.settingsPath, '{"defaultModel":"external"}', { mode: 0o600 });
  // When / Then
  await assert.rejects(panel.apply(), { code: "conflict" });
  assert.equal(panel.editor, accepted);
  assert.deepEqual(events, []);
});
