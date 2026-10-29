import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, chmod, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitDocument, editDocument, nodeValue, parseDocument, readDocument, undoDocument } from "../src/config.js";
import type { CommitHooks } from "../src/config.js";
import type { Operation } from "../src/types.js";
import { operations } from "../src/validation.js";

const chain: readonly Operation[] = [{ kind: "set-chain", group: "native", target: "category", id: "architect", models: [{ model: "fixture/new", reasoning: "high" }] }];

test("chain conversion preserves comments and unrelated values", () => {
  // Given
  const doc = parseDocument('{\n // keep me\n "packages": ["keep"], "future": {"x": 4},\n "[native]": {"categories": {"architect": {"model":"fixture/old","fallback_models":["fixture/fallback"],"prompt":"keep prompt"}}}\n}');
  // When
  const edited = editDocument(doc, chain, "native");
  // Then
  const after = parseDocument(edited.text);
  assert.match(edited.text, /\/\/ keep me/);
  assert.deepEqual(nodeValue(after, ["packages"]), ["keep"]);
  assert.deepEqual(nodeValue(after, ["future"]), { x: 4 });
  assert.equal(nodeValue(after, ["[native]", "categories", "architect", "prompt"]), "keep prompt");
  assert.equal(nodeValue(after, ["[native]", "categories", "architect", "model"]), undefined);
  assert.equal(nodeValue(after, ["[native]", "categories", "architect", "fallback_models"]), undefined);
  assert.deepEqual(nodeValue(after, ["[native]", "categories", "architect", "models"]), [{ model: "fixture/new", reasoning: "high" }]);
  assert.equal(doc.text.includes("fixture/new"), false);
  assert.equal(edited.changes.find((change) => change.path.endsWith(".models"))?.beforeKind, "unset");
  assert.equal(edited.changes.find((change) => change.path.endsWith(".model"))?.afterKind, "removed");
  assert.equal(edited.changes.find((change) => change.path.endsWith(".model"))?.beforeKind, undefined);
});

test("removing override deletes routing nodes rather than copying defaults", () => {
  // Given
  const doc = parseDocument('{"[native]":{"agents":{"explore":{"models":[{"model":"fixture/custom"}],"prompt":"keep"}}}}');
  // When
  const edited = editDocument(doc, [{ kind: "remove-override", group: "native", target: "agent", id: "explore" }], "native");
  // Then
  assert.deepEqual(nodeValue(parseDocument(edited.text), ["[native]", "agents", "explore"]), { prompt: "keep" });
});

test("unsupported fields and mixed file groups are rejected", () => {
  // Given
  const doc = parseDocument("{}");
  // When / Then
  assert.throws(() => editDocument(doc, [{ kind: "set-field", group: "settings", field: "enabledModels", value: [] }], "settings"), { code: "forbidden-path" });
  assert.throws(() => editDocument(doc, chain, "settings"), { code: "mixed-groups" });
});

test("removing an absent inherited field preserves the original document", () => {
  // Given
  const doc = parseDocument('{\n// preserved\n"other":9\n}\n');
  // When
  const edited = editDocument(doc, [
    { kind: "remove-field", group: "native", field: "memory.recall.enabled" },
    { kind: "remove-override", group: "native", target: "category", id: "custom" },
  ], "native");
  // Then
  assert.equal(edited.text, doc.text);
  assert.deepEqual(edited.nodes, []);
  assert.deepEqual(edited.changes, []);
});

for (const kind of ["set-chain", "remove-override"] as const) {
  test(`${kind} preserves route reasoning declarations and non-chain behavior through undo`, () => {
    // Given
    const declaration = {
      model: "fixture/old", fallback_models: ["fixture/fallback"],
      models: [{ model: "fixture/current", reasoning: "low" }],
      reasoning: "high", reasoningEffort: "medium", variant: "custom", disable: true, prompt: "keep",
    };
    const doc = parseDocument(JSON.stringify({ "[native]": { categories: { custom: declaration } } }), "/synthetic/omo.jsonc");
    const operation: Operation = kind === "set-chain"
      ? { kind, group: "native", target: "category", id: "custom", models: [{ model: "fixture/new" }] }
      : { kind, group: "native", target: "category", id: "custom" };
    // When
    const edited = editDocument(doc, [operation], "native");
    // Then
    const after = parseDocument(edited.text, doc.path);
    assert.deepEqual(nodeValue(after, ["[native]", "categories", "custom"]), {
      reasoning: "high", reasoningEffort: "medium", variant: "custom", disable: true, prompt: "keep",
      ...(kind === "set-chain" ? { models: [{ model: "fixture/new" }] } : {}),
    });
    assert.ok(edited.nodes.every((node) => ["models", "model", "fallback_models"].includes(node.path[3] ?? "")));
    const restored = undoDocument(after, {
      group: "native", path: doc.path, beforeRevision: doc.revision, afterRevision: after.revision,
      nodes: edited.nodes, created: edited.created,
    });
    assert.deepEqual(nodeValue(parseDocument(restored.text), ["[native]", "categories", "custom"]), declaration);
  });
}

test("invalid JSONC duplicate keys and scalar containers fail closed", () => {
  // Given / When / Then
  assert.throws(() => parseDocument('{"x":}'), { code: "invalid-jsonc" });
  assert.throws(() => parseDocument('{"[native]": {}, "[native]":{}}'), { code: "duplicate-key" });
  assert.throws(() => editDocument(parseDocument('{"[native]":false}'), chain, "native"), { code: "invalid-container" });
});

test("boundary rejects unknown operations unsafe IDs and invalid chains", () => {
  // Given / When / Then
  assert.throws(() => operations([{ kind: "shell" }]), { code: "invalid-operation" });
  assert.throws(() => operations([{ kind: "set-chain", group: "native", target: "category", id: "../escape", models: [] }]), { code: "invalid-chain" });
  assert.throws(() => operations([{ kind: "remove-override", group: "native", target: "agent", id: "__proto__" }]), { code: "invalid-id" });
  assert.throws(() => operations([{ kind: "set-chain", group: "native", target: "category", id: "x", models: [{ model: "bad" }] }]), { code: "invalid-model" });
});

async function fixture(run: (path: string, state: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(await import("node:fs/promises").then((fs) => fs.realpath(tmpdir())), "route-writer-"));
  const path = join(root, "omo.jsonc");
  try {
    await writeFile(path, '{\n// preserved\n"packages":["untouched"],"[native]":{}\n}\n', { mode: 0o600 });
    await run(path, join(root, "state"));
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("atomic save creates node backup and reversible changes", async () => {
  // Given
  await fixture(async (path, state) => {
    const doc = await readDocument(path);
    const edited = editDocument(doc, chain, "native");
    // When
    const saved = await commitDocument(doc, edited, "native", state);
    // Then
    assert.equal((await readDocument(path)).revision, saved.afterRevision);
    assert.equal(saved.nodes.length, 1);
    assert.equal(saved.beforeRevision, doc.revision);
    assert.match(await readFile(path, "utf8"), /\/\/ preserved/);
  });
});

test("external edit immediately before commit is refused without overwriting it", async () => {
  // Given
  await fixture(async (path, state) => {
    const doc = await readDocument(path);
    const external = '{"packages":["external"]}\n';
    // When / Then (an exact barrier, no timing)
    await assert.rejects(commitDocument(doc, editDocument(doc, chain, "native"), "native", state, {
      beforeCommit: async () => { await writeFile(path, external); },
    }), { code: "conflict" });
    assert.equal(await readFile(path, "utf8"), external);
  });
});

for (const boundary of ["writeTemp", "backup", "rename"] as const) {
  test(`failed ${boundary} leaves the original file intact`, async () => {
    // Given
    await fixture(async (path, state) => {
      const doc = await readDocument(path);
      const failure = new Error("synthetic failure");
      const hooks: CommitHooks = { [boundary]: async () => { throw failure; } };
      // When / Then
      await assert.rejects(commitDocument(doc, editDocument(doc, chain, "native"), "native", state, hooks), failure);
      assert.equal(await readFile(path, "utf8"), doc.text);
    });
  });
}

test("undo preserves unrelated external edits and clears only panel-created empty containers", async () => {
  // Given
  await fixture(async (path, state) => {
    const doc = await readDocument(path);
    const saved = await commitDocument(doc, editDocument(doc, chain, "native"), "native", state);
    await writeFile(path, (await readFile(path, "utf8")).replace('"untouched"', '"external"'));
    const current = await readDocument(path);
    // When
    await commitDocument(current, undoDocument(current, saved), "native", state);
    // Then
    const after = await readDocument(path);
    assert.deepEqual(nodeValue(after, ["packages"]), ["external"]);
    assert.deepEqual(nodeValue(after, ["[native]"]), {});
  });
});

test("undo refuses changed target nodes", async () => {
  // Given
  await fixture(async (path, state) => {
    const doc = await readDocument(path);
    const saved = await commitDocument(doc, editDocument(doc, chain, "native"), "native", state);
    await writeFile(path, (await readFile(path, "utf8")).replace("fixture/new", "fixture/elsewhere"));
    // When / Then
    const current = await readDocument(path);
    assert.throws(() => undoDocument(current, saved), { code: "undo-conflict" });
    assert.throws(() => undoDocument(parseDocument('{"[native]":{}}', "another"), saved), { code: "undo-conflict" });
  });
});

test("settings edits preserve budgets and retry configuration", () => {
  // Given
  const doc = parseDocument('{"compaction":{"budgetTokens":4500,"modelOverrides":{"fixture/x":2000}},"enabledModels":["fixture/*"],"retry":{"maxRetries":2}}');
  // When
  const edited = editDocument(doc, [{ kind: "set-field", group: "settings", field: "compaction.model", value: "fixture/summary" }], "settings");
  // Then
  const after = parseDocument(edited.text);
  assert.deepEqual(nodeValue(after, ["compaction", "modelOverrides"]), { "fixture/x": 2000 });
  assert.equal(nodeValue(after, ["compaction", "budgetTokens"]), 4500);
  assert.deepEqual(nodeValue(after, ["enabledModels"]), ["fixture/*"]);
  assert.deepEqual(nodeValue(after, ["retry"]), { maxRetries: 2 });
});

test("symlinks and permissive files cannot be written", async () => {
  // Given
  await fixture(async (path) => {
    await symlink(path, `${path}.link`);
    // When / Then
    await assert.rejects(readDocument(`${path}.link`), { code: "unsafe-file" });
    await chmod(path, 0o666);
    await assert.rejects(readDocument(path), { code: "unsafe-file" });
  });
});
