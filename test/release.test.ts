import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const repository = new URL(manifest.repository.url.replace(/^git\+/, "")).pathname.slice(1).replace(/\.git$/, "");

async function releaseIdentity(tag: string, repositoryName: string, refType: "tag" | "branch" = "tag"): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("scripts/check-release.mjs", root))], {
      env: { RELEASE_TAG: tag, GITHUB_REPOSITORY: repositoryName, GITHUB_REF_TYPE: refType },
      stdio: "ignore", timeout: 10000,
    });
    child.once("error", reject);
    child.once("close", (code) => resolve(code));
  });
}

test("release identity accepts the matching version and repository", async () => {
  // Given the release manifest.
  const tag = `v${manifest.version}`;
  // When the workflow supplies its matching identity.
  const code = await releaseIdentity(tag, repository);
  // Then publication can proceed.
  assert.equal(code, 0);
});

test("release identity rejects a mismatched source tag", async () => {
  // Given a tag which cannot identify the release manifest.
  const tag = `v${manifest.version}-different`;
  // When the workflow requests publication.
  const code = await releaseIdentity(tag, repository);
  // Then publication is blocked.
  assert.notEqual(code, 0);
});

test("release identity rejects provenance from another repository", async () => {
  // Given a fork which has not updated the release manifest.
  const fork = "synthetic-owner/synthetic-fork";
  // When it requests publication with the original package identity.
  const code = await releaseIdentity(`v${manifest.version}`, fork);
  // Then publication is blocked.
  assert.notEqual(code, 0);
});

test("release identity rejects a branch named like the matching version tag", async () => {
  // Given a branch whose name could otherwise pass the version check.
  const branch = `v${manifest.version}`;
  // When it requests publication.
  const code = await releaseIdentity(branch, repository, "branch");
  // Then only a real tag can authorize the release.
  assert.notEqual(code, 0);
});
