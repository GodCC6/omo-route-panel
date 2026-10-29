import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "jsonc-parser";

test("extension packaging leaves the host TUI to the host", async () => {
  // Given the shipping manifest and development lockfile.
  const root = new URL("../../", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const lock = parse(await readFile(new URL("bun.lock", root), "utf8"));

  // When selecting the runtime dependency contract.
  for (const pkg of [manifest, lock.workspaces[""]]) {
    // Then host resolution is unconstrained and no runtime edge installs a copy.
    assert.equal(pkg.peerDependencies["@earendil-works/pi-tui"], "*");
    for (const section of ["dependencies", "optionalDependencies"]) {
      for (const [name, version] of Object.entries(pkg[section] ?? {})) {
        assert.doesNotMatch(name, /(?:^|\/)(?:pi-tui|senpi-tui)$/);
        assert.doesNotMatch(String(version), /(?:pi-tui|senpi-tui)/);
      }
    }
    assert.match(pkg.devDependencies["@earendil-works/pi-tui"], /^npm:@code-yeongyu\/senpi-tui@/);
  }
  assert.equal(manifest.peerDependenciesMeta["@earendil-works/pi-tui"].optional, true);
  assert.ok(lock.workspaces[""].optionalPeers.includes("@earendil-works/pi-tui"));
  assert.deepEqual(manifest.bundledDependencies ?? manifest.bundleDependencies ?? [], []);
});
