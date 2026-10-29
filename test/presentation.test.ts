import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "../src/config.js";
import { presentRoutes } from "../src/presentation.js";
import type { NativeInspection, NativeReport } from "../src/native/index.js";

test("route projections preserve disabled and unavailable native status even without diagnostic prose", () => {
  // Given
  const report: NativeReport = {
    categories: ["disabled", "unavailable"].map((status) => ({
      kind: "category", name: status, status: status === "disabled" ? "disabled" : "unavailable",
      runtime: [], rungs: [],
    })),
    agents: [], excludeModels: [], modelProfile: {},
  };
  const inspection: NativeInspection = {
    home: "/synthetic", project: "/synthetic", files: [], watchPaths: [],
    engine: { version: "", moduleDigest: "", nodeVersion: "", runtimeRoot: "", nodePath: "", nodeSourcePath: "", launcherPath: "", launcherSourcePath: "", launcherDigest: "" },
    settings: { globalPath: "", projectPath: "", projectInfluence: "unknown", pathStatus: "verified-global" },
  };
  // When
  const rows = presentRoutes(report, { ...report, categories: [] }, parseDocument("{}"), inspection);
  // Then
  assert.deepEqual(rows.map((row) => [row.id, row.status, row.effective]), [["disabled", "disabled", []], ["unavailable", "unavailable", []]]);
});

for (const legacy of [false, true]) {
  test(`route projections keep ${legacy ? "legacy" : "ordered"} candidate reasoning separate from route declarations`, () => {
    // Given
    const report: NativeReport = {
      categories: [{ kind: "category", name: "custom", status: "resolved", runtime: ["fixture/one", "fixture/two"], rungs: [] }],
      agents: [], excludeModels: [], modelProfile: {},
    };
    const inspection: NativeInspection = {
      home: "/synthetic", project: "/synthetic", files: [], watchPaths: [],
      engine: { version: "", moduleDigest: "", nodeVersion: "", runtimeRoot: "", nodePath: "", nodeSourcePath: "", launcherPath: "", launcherSourcePath: "", launcherDigest: "" },
      settings: { globalPath: "", projectPath: "", projectInfluence: "unknown", pathStatus: "verified-global" },
    };
    const doc = parseDocument(JSON.stringify({ "[native]": { categories: { custom: {
      reasoning: "high", reasoningEffort: "medium", variant: "custom",
      ...(legacy
        ? { model: "fixture/one", fallback_models: [{ model: "fixture/two", reasoning: "low" }] }
        : { models: ["fixture/one", { model: "fixture/two", reasoning: "low" }] }),
    } } } }));
    // When
    const [route] = presentRoutes(report, { ...report, categories: [] }, doc, inspection);
    // Then
    assert.deepEqual(route?.override, [{ model: "fixture/one" }, { model: "fixture/two", reasoning: "low" }]);
    assert.deepEqual(route?.routeReasoning, { reasoning: "high", reasoningEffort: "medium", variant: "custom" });
    assert.deepEqual(route?.effective, [{ model: "fixture/one" }, { model: "fixture/two" }]);
  });
}
