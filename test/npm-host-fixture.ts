import { once } from "node:events";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HostContext } from "../src/extension.js";

/** Runs inside the synthetic engine, before Route Panel itself is imported. */
export async function runNpmHost(loadedIdentity: string): Promise<void> {
  const home = homedir();
  const pluginPath = process.env["NPM_HOST_PLUGIN"] ?? join(home, "node_modules", "omo-ai", "plugin", "extensions", "omo.js");
  const plugin: unknown = (await import(pathToFileURL(pluginPath).href)).plugin;
  process.send?.({ ready: true, loadedIdentity, plugin });
  await once(process, "message");
  const { extension } = await import("../src/extension.js");
  let handler: ((args: string, context: HostContext) => Promise<void>) | undefined;
  extension({
    on() {},
    registerCommand(_name, command) { handler = command.handler; },
  });
  if (handler === undefined) throw new Error("Missing Route Panel command");
  const notices: string[] = [];
  const context = {
    mode: "tui", cwd: home, agentDir: join(home, ".omo", "agent"),
    loadedExtensionPaths: [pluginPath],
    modelRegistry: { modelRuntime: { getAvailable: async () => [] } },
    reload: async () => {},
    ui: {
      notify(message: string) { notices.push(message); },
      custom: async () => {
        process.send?.({ opened: true, notices, loadedIdentity }, () => process.exit(0));
        return new Promise<never>(() => {});
      },
    },
  };
  await handler("", context);
  process.send?.({ opened: false, notices, loadedIdentity });
  process.disconnect?.();
}
