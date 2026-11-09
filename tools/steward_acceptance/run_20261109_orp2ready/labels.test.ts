import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalLabel } from "./labels.js";

const normalizationCases = [
  { name: "normalizes ordinary text", input: "Route Panel", expected: "route-panel" },
  { name: "trims surrounding whitespace", input: "  Route Panel  ", expected: "route-panel" },
  { name: "replaces tabs with a hyphen", input: "Route\tPanel", expected: "route-panel" },
  { name: "collapses mixed whitespace runs", input: "Route \n\t  Panel\u2003Preview", expected: "route-panel-preview" },
  { name: "preserves Unicode letters and text", input: "  ÉCOLE\t世界  ", expected: "école-世界" },
] as const;

for (const { name, input, expected } of normalizationCases) {
  test(`canonicalLabel ${name}`, () => {
    // Given / When
    const result = canonicalLabel(input);
    // Then
    assert.equal(result, expected);
  });
}

for (const [index, input] of ["", "   ", "\t\n\u2003"].entries()) {
  test(`canonicalLabel rejects whitespace-only input ${index + 1}`, () => {
    // Given / When / Then
    assert.throws(() => canonicalLabel(input), /non-whitespace/);
  });
}
