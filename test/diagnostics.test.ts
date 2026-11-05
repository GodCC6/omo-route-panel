import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hostFailure } from "../src/errors.js";
import { NativeError } from "../src/native/config.js";

test("host verification failures keep the failing check's safe code", () => {
  // Given a native check that runs before any panel state exists.
  const failure = hostFailure(new NativeError("engine-launcher-mismatch"), "generic fallback");
  // When / Then the user sees the stage-specific code and the supported layouts.
  assert.match(failure, /\(engine-launcher-mismatch\)/);
  assert.match(failure, /npm omo-ai package/);
  assert.doesNotMatch(failure, /generic fallback/);
});

test("an unrecognized failure keeps the generic sanitized message", () => {
  // Given a failure that carries no safe native code.
  const failure = hostFailure(new Error("/private/installation path"), "generic fallback");
  // When / Then
  assert.equal(failure, "generic fallback");
});
