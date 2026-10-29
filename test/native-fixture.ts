import { mkdtemp, mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAdapter, catalogSnapshot } from "../src/native/index.js";
import type { NativeAdapter, NativeCatalog, NativeOptions } from "../src/native/index.js";
import { integrationLauncher, integrationNode } from "./integration-env.js";

export const models = catalogSnapshot([
  { provider: "openai", id: "gpt-6-astra", name: "Synthetic metadata" },
  { provider: "anthropic", id: "claude-fable-5-1" },
  { provider: "fixture", id: "one" }, { provider: "fixture", id: "two" },
]);

/** Explicit injection for report tests; this is not installed-runtime catalog evidence. */
export function syntheticCatalogAdapter(options: NativeOptions, catalog: NativeCatalog = models): NativeAdapter {
  return createNativeAdapter({
    ...options,
    host: {
      catalog: async () => catalog,
      // Synthetic report fixtures explicitly omit real running-host verification.
      verify: async () => {},
    },
  });
}

export async function fixture(t: { after(fn: () => Promise<void>): void }, native = false) {
  const home = await mkdtemp(join(await realpath(tmpdir()), "native-contract-"));
  t.after(() => rm(home, { recursive: true, force: true }));
  const project = join(home, "parent", "project");
  await mkdir(project, { recursive: true });
  async function config(base: string, value: unknown, filename = "omo.jsonc"): Promise<string> {
    await mkdir(join(base, ".omo"), { recursive: true });
    const path = join(base, ".omo", filename);
    await writeFile(path, JSON.stringify(value), { mode: 0o600 });
    return path;
  }
  const launcherPath = native ? integrationLauncher() : join(await futureRuntime(home, "synthetic-contract"), "omo");
  return { home, project, config, launcherPath, adapter: syntheticCatalogAdapter({ home, launcherPath, nodePath: native ? integrationNode : process.execPath }) };
}

/** Fixed empty reports exercise worker contracts, never emulate native routing. */
export async function futureRuntime(home: string, name: string, malformed = false): Promise<string> {
  const root = join(home, name);
  await mkdir(join(root, "plugin/runtime/category-coverage"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "omo", version: name, type: "module" }));
  await writeFile(join(root, "omo"), `synthetic executable ${name}`);
  await writeFile(join(root, "plugin/runtime/category-coverage/index.js"), `
    export function modelChains() { return ${malformed ? '{"categories":"invalid"}' : '{"categories":[],"agents":[],"excludeModels":[],"modelProfile":{}}'}; }
    export function configDoctorLines() { return []; }
  `);
  return root;
}
