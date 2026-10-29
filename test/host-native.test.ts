import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { createNativeAdapter } from "../src/native/index.js";
import { NativeError } from "../src/native/config.js";
import { fixture, models } from "./native-fixture.js";
import type { NativeCatalog } from "../src/native/index.js";

test("an injected host catalog resolves user and project scopes without socket provenance", async (t) => {
  // Given
  const f = await fixture(t);
  await f.config(f.home, {});
  await f.config(f.project, {});
  let verifications = 0;
  const adapter = createNativeAdapter({
    home: f.home, launcherPath: join(f.home, "synthetic-contract", "omo"),
    host: { catalog: async () => models, verify: async () => { verifications++; } },
  });
  // When
  const user = await adapter.resolve({ project: f.home, catalog: models });
  const project = await adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.equal(user.status, "ok", JSON.stringify(user));
  assert.equal(project.status, "ok", JSON.stringify(project));
  assert.equal(verifications, 4);
  if (user.status === "ok") assert.ok(user.value.inspection.files.every((file) => file.scope === "user"));
  if (project.status === "ok") assert.ok(project.value.inspection.files.some((file) => file.scope === "project"));
});

test("host availability drift at the final resolution boundary rejects stale reports", async (t) => {
  // Given
  const f = await fixture(t);
  let calls = 0;
  const adapter = createNativeAdapter({
    home: f.home, launcherPath: join(f.home, "synthetic-contract", "omo"),
    host: {
      catalog: async (): Promise<NativeCatalog> => ++calls === 1 ? models : { status: "unknown", code: "synthetic-host-failed" },
      verify: async () => {},
    },
  });
  // When
  const result = await adapter.resolve({ project: f.home, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "host-catalog-changed" });
  assert.equal(calls, 2);
});

test("retired host generations cannot authorize resolution", async (t) => {
  // Given
  const f = await fixture(t);
  const abort = new AbortController();
  const adapter = createNativeAdapter({
    home: f.home, launcherPath: join(f.home, "synthetic-contract", "omo"), signal: abort.signal,
    host: { catalog: async () => models, verify: async () => { abort.abort(); } },
  });
  // When
  const result = await adapter.resolve({ project: f.home, catalog: models });
  // Then
  assert.notEqual(result.status, "ok");
});

test("the host installation verifier is enforced before importing routing reports", async (t) => {
  // Given
  const f = await fixture(t);
  const adapter = createNativeAdapter({
    home: f.home, launcherPath: join(f.home, "synthetic-contract", "omo"),
    host: { catalog: async () => models, verify: async () => { throw new NativeError("host-installation-changed"); } },
  });
  // When
  const result = await adapter.resolve({ project: f.home, catalog: models });
  // Then
  assert.deepEqual(result, { status: "unsupported", code: "host-installation-changed" });
});

test("host catalog lookup exposes its failure rather than an empty model set", async (t) => {
  // Given
  const f = await fixture(t);
  const adapter = createNativeAdapter({
    home: f.home, launcherPath: join(f.home, "synthetic-contract", "omo"),
    host: { catalog: async () => ({ status: "unknown", code: "host-unavailable" }), verify: async () => {} },
  });
  // When / Then
  assert.deepEqual(await adapter.catalog({ project: f.home }), { status: "unknown", code: "host-unavailable" });
});
