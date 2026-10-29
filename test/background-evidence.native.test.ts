import assert from "node:assert/strict";
import { test } from "node:test";
import { loadBackgroundEvidence } from "../src/background-evidence.js";
import { installedRuntime } from "../src/runtime.js";
import { integrationLauncher } from "./integration-env.js";

test("native background semantics have safe installation-bound source evidence", async (t) => {
  // Given: explicit launcher discovery reads installation artifacts, not configuration.
  // Keep cache discovery available for a copied launcher matched by binary digest.
  const installation = await installedRuntime({ launcherPath: integrationLauncher() });
  // When: read implementation source without importing or executing it.
  const evidence = await loadBackgroundEvidence(installation.runtimeRoot);
  // Then: synthetic mapping tests are not counted as upstream verification.
  assert.equal(evidence.runtimeRoot, installation.runtimeRoot);
  assert.equal(evidence.artifacts.length, 1);
  for (const [id, rule] of Object.entries(evidence.rules)) {
    assert.equal(rule.status, "verified", `${id}: ${rule.reason}`);
    assert.equal(rule.method, "recorded-source-contract");
    assert.ok(rule.references.length > 0, id);
  }
  t.diagnostic(`Read-only source inspection ${evidence.checkedAt}; artifact SHA-256 ${evidence.artifacts[0]?.digest}; rules ${Object.keys(evidence.rules).join(", ")}. No session, hook or inference call.`);
});
