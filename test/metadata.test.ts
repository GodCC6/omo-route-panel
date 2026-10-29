import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAgentDir } from "../src/metadata.js";
import { catalogSnapshot, sanitizeModels } from "../src/native/catalog.js";

// Retired: SDK verification, socket discovery, authentication, registration
// rotation, endpoint aggregation and credential-file revisions. There is no
// standalone transport or credential reader in the product. Host freshness and
// installation binding are covered by native.test.ts and host-native.test.ts;
// mapped executable identity is covered by host-process.test.ts.

test("agent directory follows the environment precedence", () => {
  // Given / When / Then
  assert.equal(resolveAgentDir("/fixture", {}), "/fixture/.omo/agent");
  assert.equal(resolveAgentDir("/fixture", { OMO_CODING_AGENT_DIR: "/omo", SENPI_CODING_AGENT_DIR: "/senpi" }), "/omo");
  assert.equal(resolveAgentDir("/fixture", { OMO_CODING_AGENT_DIR: "  ", SENPI_CODING_AGENT_DIR: "/senpi" }), "/senpi");
  assert.equal(resolveAgentDir("/fixture", { PI_CODING_AGENT_DIR: "/pi" }), "/pi");
});

test("host model sanitization strips credentials and private provider fields", () => {
  // Given / When
  const result = catalogSnapshot([{
    provider: "fixture", id: "one", name: "One", reasoning: true, input: ["text", "image"],
    baseUrl: "private", headers: { Authorization: "SYNTHETIC_SECRET" }, apiKey: "SYNTHETIC_SECRET",
    contextWindow: 100, maxTokens: 50, cost: { input: 0, output: 2, cacheRead: 1, cacheWrite: 3, private: 1 },
  }]);
  // Then
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.models, [{
    provider: "fixture", id: "one", name: "One", reasoning: true, input: ["text", "image"],
    contextWindow: 100, maxTokens: 50, cost: { input: 0, output: 2, cacheRead: 1, cacheWrite: 3 },
  }]);
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_SECRET|apiKey|Authorization|baseUrl|private/);
});

test("host catalog preserves provider-like segments in complete raw model IDs", () => {
  // Given / When
  const result = catalogSnapshot([{ provider: "extension", id: "extension/vendor/\u6a21\u578b" }]);
  // Then
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.models, [{ provider: "extension", id: "extension/vendor/\u6a21\u578b" }]);
  assert.equal(`${result.models[0]?.provider}/${result.models[0]?.id}`, "extension/extension/vendor/\u6a21\u578b");
});

test("catalog revisions depend on sanitized models, not ordering or capture time", () => {
  // Given
  const a = { provider: "fixture", id: "a" };
  const b = { provider: "fixture", id: "b" };
  const before = catalogSnapshot([b, a], "2026-10-27T00:00:00Z");
  // When
  const after = catalogSnapshot([{ ...a, apiKey: "SYNTHETIC_PRIVATE" }, b], "2026-10-28T00:00:00Z");
  const changed = catalogSnapshot([a]);
  // Then
  assert.equal(before.status, "ok");
  assert.equal(after.status, "ok");
  assert.equal(changed.status, "ok");
  if (before.status !== "ok" || after.status !== "ok" || changed.status !== "ok") return;
  assert.deepEqual(after.models, [a, b]);
  assert.equal(after.revision, before.revision);
  assert.notEqual(changed.revision, before.revision);
});

test("malformed host catalogs fail explicitly rather than becoming empty availability", () => {
  // Given / When / Then
  for (const input of [null, {}, [{ apiKey: "SYNTHETIC_SECRET" }], [{ provider: "", id: "one" }], [{ provider: "fixture", id: "" }]]) {
    assert.deepEqual(catalogSnapshot(input), { status: "unknown", code: "catalog-shape" });
  }
  assert.throws(() => sanitizeModels([null]), { name: "NativeError", code: "catalog-shape", message: "catalog-shape" });
  assert.equal(catalogSnapshot([]).status, "ok");
});

test("model optional metadata excludes unsupported modalities and invalid numeric fields", () => {
  // Given / When
  const models = sanitizeModels([{
    provider: "fixture", id: "one", input: ["audio"], contextWindow: Infinity, maxTokens: -1,
    cost: { input: NaN, output: -1, cacheRead: 0 },
  }]);
  // Then
  assert.deepEqual(models, [{ provider: "fixture", id: "one", cost: { cacheRead: 0 } }]);
});
