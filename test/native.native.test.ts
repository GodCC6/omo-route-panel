import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discover } from "../src/native/config.js";
import type { ConfigObject } from "../src/native/index.js";
import { fixture as makeFixture, models } from "./native-fixture.js";

const fixture = (t: { after(fn: () => Promise<void>): void }) => makeFixture(t, true);

test("native mirrors a current project outside HOME without path escape or changing its user target", async (t) => {
  // Given
  const f = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), "route-outside-home-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const userPath = await f.config(f.home, { categories: { custom: { models: ["fixture/one"] } } });
  await f.config(outside, { categories: { custom: { models: ["fixture/two"] } } });
  const found = await f.adapter.inspect({ project: outside });
  assert.equal(found.status, "ok", JSON.stringify(found));
  if (found.status !== "ok") return;
  const user = found.value.files.find((file) => file.scope === "user");
  assert.ok(user);
  // When
  const result = await f.adapter.resolve({ project: outside, catalog: models,
    candidate: { [user.sourceId]: { categories: { custom: { models: ["fixture/two"] } } } } });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status !== "ok") return;
  assert.equal(result.value.effective.report.categories.find((route) => route.name === "custom")?.primary, "fixture/two");
  assert.equal(result.value.candidate?.report.categories.find((route) => route.name === "custom")?.primary, "fixture/two");
  assert.equal(result.value.inspection.files.find((file) => file.scope === "user")?.path, userPath);
  assert.equal(result.value.equivalence, "equal");
});

test("native defaults and mirror match with one synthetic catalog", async (t) => {
  // Given
  const f = await fixture(t);
  await f.config(f.home, { categories: {}, agents: {}, models: {} });
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status !== "ok") return;
  assert.equal(result.value.effective.report.categories.length, 10);
  assert.equal(result.value.effective.report.agents.length, 7);
  assert.deepEqual(result.value.effective, result.value.defaults);
  assert.equal(result.value.equivalence, "equal");
});

test("native combines ancestor root native and profile layers without writing live files", async (t) => {
  // Given
  const f = await fixture(t);
  const path = await f.config(f.home, {
    models: { alias: { model: "fixture/one", reasoning: "high" } },
    categories: { architect: { models: ["alias"] } },
    "[native]": { categories: { architect: { models: [{ model: "fixture/one", reasoning: "high" }] } } },
    profiles: { focus: { "[native]": { categories: { architect: { models: ["fixture/two"] } } } } },
  });
  await f.config(join(f.home, "parent"), { categories: { custom: { models: ["fixture/one"] } } });
  await f.config(f.project, { "[native]": { categories: { custom: { models: ["fixture/two"] } } } });
  const before = await readFile(path, "utf8");
  const found = await f.adapter.inspect({ project: f.project, profile: "focus" });
  assert.equal(found.status, "ok", JSON.stringify(found));
  if (found.status !== "ok") return;
  const user = found.value.files.find((file) => file.scope === "user");
  assert.ok(user);
  const replacement: ConfigObject = {
    ...user.config, profiles: { focus: { "[native]": { categories: { architect: { models: ["fixture/one"] } } } } },
  };
  // When
  const result = await f.adapter.resolve({
    project: f.project, profile: "focus", catalog: models, candidate: { [user.sourceId]: replacement },
  });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status !== "ok") return;
  assert.equal(result.value.effective.report.categories.find((row) => row.name === "architect")?.primary, "fixture/two");
  assert.equal(result.value.candidate?.report.categories.find((row) => row.name === "architect")?.primary, "fixture/one");
  assert.equal(result.value.effective.report.categories.find((row) => row.name === "custom")?.primary, "fixture/two");
  assert.equal(result.value.defaults.report.categories.some((row) => row.name === "custom"), false);
  assert.equal(await readFile(path, "utf8"), before);
});

test("native inserts a missing global source in candidate mirror only", async (t) => {
  // Given
  const f = await fixture(t);
  const found = discover(f.home, f.project);
  const source = found.files[0];
  assert.ok(source);
  assert.equal(source.revision, "absent");
  // When
  const result = await f.adapter.resolve({
    project: f.project, catalog: models,
    candidate: { [source.sourceId]: { "[native]": { categories: { custom: { models: ["fixture/one"] } } } } },
  });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status !== "ok") return;
  assert.equal(result.value.candidate?.report.categories.find((row) => row.name === "custom")?.primary, "fixture/one");
  await assert.rejects(readFile(source.path), { code: "ENOENT" });
});

test("native alias expansion preserves same-catalog equivalence", async (t) => {
  // Given
  const f = await fixture(t);
  await f.config(f.home, {
    models: { fast: { model: "fixture/one", reasoning: "high" } },
    "[native]": { categories: { custom: { models: ["fast"] } } },
  });
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.equal(result.status, "ok", JSON.stringify(result));
  if (result.status !== "ok") return;
  assert.equal(result.value.effective.report.categories.find((row) => row.name === "custom")?.primary, "fixture/one");
});

test("native fails closed on diagnostic-bearing invalid route configuration", async (t) => {
  // Given
  const f = await fixture(t);
  await f.config(f.home, { "[native]": { categories: { custom: { models: 42 } } } });
  // When
  const result = await f.adapter.resolve({ project: f.project, catalog: models });
  // Then
  assert.equal(result.status, "unsupported");
  if (result.status === "unsupported") assert.ok(["mirror-mismatch", "config-diagnostics", "config-shape"].includes(result.code));
});
