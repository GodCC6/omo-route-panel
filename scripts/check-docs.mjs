import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = ["README.md", "CONTRIBUTING.md", "SECURITY.md", "DESIGN.md", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"];
async function discover(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await discover(path);
    else if (entry.name.endsWith(".md")) files.push(path);
  }
}
await discover("docs");
const failures = [];
for (const file of files) {
  const content = await readFile(join(root, file), "utf8");
  const source = content.replace(/^```[\s\S]*?^```/gm, "");
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const link = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(link)) continue;
    const path = decodeURIComponent(link.split("#")[0]);
    if (!path) continue;
    try { await access(join(root, dirname(file), path)); }
    catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
      failures.push(`${file}: missing link target ${link}`);
    }
  }
  if (/\/Users\/[a-zA-Z0-9_-]+\//.test(content)) failures.push(`${file}: contains a machine-specific home path`);
}
if (failures.length) throw new Error(failures.join("\n"));
console.log(`DOCS_OK files=${files.length}`);
