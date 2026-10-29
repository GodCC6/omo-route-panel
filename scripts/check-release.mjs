import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(process.env.GITHUB_REF_TYPE, "tag", "Release verification must run at a tag, not a branch.");
assert.equal(process.env.RELEASE_TAG, `v${manifest.version}`, "The selected tag must match package.json.");
assert.equal(manifest.private, undefined, "A release must not be marked private.");
assert.equal(manifest.license, "MIT");
assert.equal(manifest.publishConfig.access, "public");
assert.equal(manifest.publishConfig.registry, "https://registry.npmjs.org/");
assert.equal(manifest.repository.url, `git+https://github.com/${process.env.GITHUB_REPOSITORY}.git`,
  "The npm repository must match the repository issuing provenance.");
console.log(`RELEASE_OK package=${manifest.name} version=${manifest.version}`);
