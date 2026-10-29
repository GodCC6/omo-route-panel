import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPanelController } from "../src/editor.js";
import { catalogSnapshot, createNativeAdapter } from "../src/native/index.js";
import { fixture } from "./native-fixture.js";
import { nodeValue, readDocument } from "../src/config.js";
import { record } from "../src/presentation.js";

for (const scenario of ["missing-model", "available-alias", "missing-alias"] as const) {
  test(`native chain undo validates ${scenario} using the installed routing oracle`, async (t) => {
    // Given
    const f = await fixture(t, true);
    const alias = scenario !== "missing-model";
    const originalModel = alias ? "fast" : "fixture/one";
    const path = await f.config(f.home, {
      models: { fast: { model: "fixture/one", reasoning: "high" } },
      "[native]": { categories: { quick: { models: [originalModel] } } },
    });
    let catalog = catalogSnapshot([{ provider: "fixture", id: "one" }, { provider: "fixture", id: "two" }]);
    const adapter = createNativeAdapter({
      home: f.home, launcherPath: f.launcherPath,
      host: { catalog: async () => catalog, verify: async () => {} },
    });
    const controller = () => createPanelController({
      home: f.home, project: f.project, registryContext: f.project, adapter,
      signal: new AbortController().signal, reload: async () => {},
    });
    const panel = controller();
    await panel.read("user");
    panel.begin("native");
    await panel.change([{ kind: "set-chain", group: "native", target: "category", id: "quick", models: [{ model: "fixture/two" }] }]);
    await panel.apply();
    const saved = await readFile(path, "utf8");
    if (scenario !== "available-alias") catalog = catalogSnapshot([{ provider: "fixture", id: "two" }]);
    const reopened = controller();
    await reopened.read("user");
    // When / Then
    if (scenario === "available-alias") {
      await reopened.undo();
      assert.deepEqual(reopened.editor?.routes.find((route) => route.id === "quick")?.effective.map((candidate) => candidate.model), ["fixture/one"]);
      assert.equal((await reopened.apply()).status, "saved");
      assert.deepEqual(nodeValue(await readDocument(path), ["[native]", "categories", "quick", "models"]), ["fast"]);
    } else {
      await assert.rejects(reopened.undo(), { code: "unknown-model" });
      assert.equal(await readFile(path, "utf8"), saved);
    }
  });
}

for (const fallback of ["fixture/two", [{ model: "fixture/two", reasoning: "high" }]] as const) {
  test(`editing a native legacy ${typeof fallback === "string" ? "scalar" : "object"} fallback preserves its candidates`, async (t) => {
    // Given
    const f = await fixture(t, true);
    const path = await f.config(f.home, { "[native]": { categories: {
      custom: { model: "fixture/one", fallback_models: fallback },
    } } });
    const panel = createPanelController({
      home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter,
      signal: new AbortController().signal, reload: async () => {},
    });
    await panel.read("user");
    const chain = panel.view?.routes.find((route) => route.id === "custom")?.override;
    assert.ok(chain);
    assert.deepEqual(chain.map((candidate) => candidate.model), ["fixture/one", "fixture/two"]);
    panel.begin("native");
    // When
    await panel.change([{ kind: "set-chain", group: "native", target: "category", id: "custom",
      models: chain.map((candidate, index) => index === 0 ? { ...candidate, reasoning: "low" } : candidate) }]);
    await panel.apply();
    // Then
    assert.deepEqual(nodeValue(await readDocument(path), ["[native]", "categories", "custom", "models"]), [
      { model: "fixture/one", reasoning: "low" },
      typeof fallback === "string" ? { model: "fixture/two" } : { model: "fixture/two", reasoning: "high" },
    ]);
  });
}

for (const harness of ["root", "[native]", "[senpi]"] as const) {
  test(`model profiles in an active ${harness} profile layer remain selectable`, async (t) => {
    // Given
    const f = await fixture(t, true);
    const declaration = { model_profiles: { custom: { models: ["fixture/one"] } } };
    await f.config(f.home, { profiles: { focus: harness === "root" ? declaration : { [harness]: declaration } } });
    const panel = createPanelController({
      home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter, profile: "focus",
      signal: new AbortController().signal, reload: async () => {},
    });
    await panel.read("user");
    panel.begin("native");
    // When
    await panel.change([{ kind: "set-field", group: "native", field: "model_profile", value: "custom" }]);
    // Then
    assert.equal(record(panel.editor?.modelProfile)["profile"], "custom");
    assert.equal(record(panel.editor?.modelProfile)["applied"], "fixture/one");
  });
}

test("native reorder preserves raw candidate inheritance and route reasoning through Apply and Undo", async (t) => {
  // Given
  const f = await fixture(t, true);
  const declaration = {
    models: ["fixture/one", { model: "fixture/two", reasoning: "low" }],
    reasoning: "high", reasoningEffort: "medium", variant: "high",
  };
  const path = await f.config(f.home, { "[native]": { categories: { custom: declaration } } });
  const controller = () => createPanelController({
    home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter,
    signal: new AbortController().signal, reload: async () => {},
  });
  const panel = controller();
  await panel.read("user");
  const route = panel.view?.routes.find((entry) => entry.id === "custom");
  assert.deepEqual(route?.override, [{ model: "fixture/one" }, { model: "fixture/two", reasoning: "low" }]);
  assert.ok(route?.override);
  panel.begin();
  // When
  await panel.change([{ kind: "set-chain", group: "native", target: "category", id: "custom", models: [...route.override].reverse() }]);
  // Then
  assert.deepEqual(panel.editor?.routes.find((entry) => entry.id === "custom")?.effective.map((candidate) => candidate.model), ["fixture/two", "fixture/one"]);
  assert.deepEqual(panel.editor?.changes.map((change) => change.path), ["[native].categories.custom.models"]);
  await panel.apply();
  assert.deepEqual(nodeValue(await readDocument(path), ["[native]", "categories", "custom"]), {
    ...declaration, models: [{ model: "fixture/two", reasoning: "low" }, { model: "fixture/one" }],
  });
  const reopened = controller();
  await reopened.read("user");
  reopened.begin();
  await reopened.undo();
  await reopened.apply();
  assert.deepEqual(nodeValue(await readDocument(path), ["[native]", "categories", "custom"]), declaration);
});

for (const disabled of [false, true]) {
  test(`native chain inheritance retains ${disabled ? "disabled" : "custom"} route behavior and supports Undo`, async (t) => {
    // Given
    const f = await fixture(t, true);
    const declaration = {
      models: ["fixture/one"], reasoning: "high", reasoningEffort: "medium", variant: "high",
      ...(disabled ? { disable: true } : {}),
    };
    const path = await f.config(f.home, { "[native]": { categories: { custom: declaration } } });
    const controller = () => createPanelController({
      home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter,
      signal: new AbortController().signal, reload: async () => {},
    });
    const panel = controller();
    await panel.read("user");
    panel.begin();
    // When
    await panel.change([{ kind: "remove-override", group: "native", target: "category", id: "custom" }]);
    // Then
    const proposed = panel.editor?.routes.find((entry) => entry.id === "custom");
    assert.deepEqual(proposed?.effective ?? [], []);
    assert.notEqual(proposed?.status, "resolved");
    await panel.apply();
    const saved = nodeValue(await readDocument(path), ["[native]", "categories", "custom"]);
    assert.deepEqual(saved, {
      reasoning: "high", reasoningEffort: "medium", variant: "high", ...(disabled ? { disable: true } : {}),
    });
    const reopened = controller();
    await reopened.read("user");
    await reopened.undo();
    await reopened.apply();
    assert.deepEqual(nodeValue(await readDocument(path), ["[native]", "categories", "custom"]), declaration);
  });
}

test("reverting an accepted reorder restores the saved raw chain declaration without a write", async (t) => {
  // Given
  const f = await fixture(t, true);
  const path = await f.config(f.home, { "[native]": { categories: { custom: {
    models: ["fixture/one", { model: "fixture/two", reasoning: "low" }], reasoning: "high",
  } } } });
  const panel = createPanelController({
    home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter,
    signal: new AbortController().signal, reload: async () => {},
  });
  await panel.read("user");
  const original = await readFile(path, "utf8");
  const chain = panel.view?.routes.find((route) => route.id === "custom")?.override;
  assert.ok(chain);
  panel.begin();
  await panel.change([{ kind: "set-chain", group: "native", target: "category", id: "custom", models: [...chain].reverse() }]);
  // When
  await panel.change([{ kind: "set-chain", group: "native", target: "category", id: "custom", models: chain }]);
  // Then
  assert.deepEqual(panel.editor?.changes, []);
  await assert.rejects(panel.apply(), { code: "no-changes" });
  await panel.read("project");
  assert.equal(panel.editor, null);
  assert.equal(await readFile(path, "utf8"), original);
});

test("an unavailable chain does not block another entry and rejected replacement preserves accepted changes", async (t) => {
  // Given
  const f = await fixture(t, true);
  const path = await f.config(f.home, { "[native]": { categories: {
    custom: { models: ["fixture/missing-one", "fixture/missing-two"] },
  } } });
  const panel = createPanelController({
    home: f.home, project: f.project, registryContext: f.project, adapter: f.adapter,
    signal: new AbortController().signal, reload: async () => {},
  });
  await panel.read("user");
  panel.begin();
  await panel.change([{ kind: "set-field", group: "native", field: "memory.recall.enabled", value: false }]);
  const accepted = panel.editor;
  const before = await readFile(path, "utf8");
  // When / Then
  await assert.rejects(panel.change([{ kind: "set-chain", group: "native", target: "category", id: "custom",
    models: [{ model: "fixture/one" }, { model: "fixture/missing-two" }] }]), { code: "unknown-model" });
  assert.equal(panel.editor, accepted);
  assert.equal(await readFile(path, "utf8"), before);
  await panel.change([{ kind: "set-chain", group: "native", target: "category", id: "custom",
    models: [{ model: "fixture/one" }, { model: "fixture/two" }] }]);
  assert.deepEqual(panel.editor?.routes.find((route) => route.id === "custom")?.effective.map((candidate) => candidate.model), ["fixture/one", "fixture/two"]);
  assert.equal(panel.editor?.fields["native:memory.recall.enabled"], false);
  await panel.apply();
  assert.deepEqual(nodeValue(await readDocument(path), ["[native]", "categories", "custom", "models"]), [{ model: "fixture/one" }, { model: "fixture/two" }]);
});
