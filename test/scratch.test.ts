import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { cleanupMirrors, createMirrorRoot } from "../src/scratch.js";

test("cleanup removes only manifest-owned mirrors whose process no longer exists", async () => {
  // Given
  const base = await mkdtemp(join(tmpdir(), "route-cleanup-"));
  try {
    const own = await createMirrorRoot(base);
    await writeFile(join(own, ".omo-route-panel-manifest.json"), '{"app":"omo-route-panel","kind":"native-mirror","pid":2147483647}');
    const unowned = join(base, "omo-route-native-unowned");
    await mkdir(unowned);
    await writeFile(join(unowned, "preserve"), "preserve");
    // When
    await cleanupMirrors(base);
    // Then
    assert.deepEqual(await readdir(base), ["omo-route-native-unowned"]);
    assert.equal(await readFile(join(unowned, "preserve"), "utf8"), "preserve");
  } finally { await rm(base, { recursive: true, force: true }); }
});

test("cleanup never removes an active process mirror", async () => {
  // Given
  const base = await mkdtemp(join(tmpdir(), "route-cleanup-"));
  try {
    const own = await createMirrorRoot(base);
    // When
    await cleanupMirrors(base);
    // Then
    assert.equal((await readdir(base)).length, 1);
    assert.equal(typeof await readFile(join(own, ".omo-route-panel-manifest.json"), "utf8"), "string");
  } finally { await rm(base, { recursive: true, force: true }); }
});
