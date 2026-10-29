import { mkdir, writeFile } from "node:fs/promises";

await mkdir(new URL("../dist/extension/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../dist/extension/index.js", import.meta.url),
  'export { extension as default } from "../src/extension.js";\n',
);
