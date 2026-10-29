import { homedir } from "node:os";
import { matchesKey, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";
import { catalogExecutable, verifyCatalogExecutable } from "./catalog-process.js";
import { createPanelController } from "./editor.js";
import { PanelError } from "./errors.js";
import { catalogSnapshot, createNativeAdapter } from "./native/index.js";
import { NativeError } from "./native/config.js";
import { runProcess } from "./native/process.js";
import { installedRuntime } from "./runtime.js";
import { createPanelComponent } from "./tui.js";
import type { PanelController } from "./tui-contract.js";
import type { NativeModel } from "./native/index.js";
import type { PanelComponent } from "./tui.js";

/** The public host seam used here, intentionally independent of SDK internals. */
export interface HostContext {
  readonly mode: string;
  readonly cwd: string;
  readonly agentDir: string;
  readonly modelRegistry: { readonly modelRuntime: { getAvailable(): Promise<readonly NativeModel[]> } };
  readonly ui: {
    notify(message: string, type: "error" | "warning" | "info"): void;
    custom<T>(factory: (tui: TUI, theme: { fg(color: "accent" | "muted" | "error", text: string): string }, keybindings: unknown, done: (result: T) => void) => PanelComponent): Promise<T>;
  };
  reload(): Promise<void>;
}
export interface HostAPI {
  on(name: "session_shutdown", callback: () => void): void;
  registerCommand(name: string, command: {
    readonly description: string;
    readonly handler: (args: string, context: HostContext) => Promise<void>;
  }): void;
}

/** OMO owns the process, registry and UI. This package owns only the editor. */
export function extension(api: HostAPI): void {
  let active: { readonly controller: PanelController; readonly abort: AbortController; readonly done: () => void } | null = null;
  let opening = false;
  let generation = 0;
  function release(controller: PanelController | null): void {
    if (active?.controller === controller) active = null;
  }
  api.on("session_shutdown", () => {
    generation++;
    const previous = active;
    active = null;
    previous?.controller.close();
    previous?.abort.abort();
    previous?.done();
  });
  api.registerCommand("route-panel", {
    description: "Inspect and edit new-task routing in the native TUI",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Route Panel requires the interactive OMO TUI.", "error");
        return;
      }
      if (active || opening) {
        ctx.ui.notify("Route Panel is already open.", "warning");
        return;
      }
      opening = true;
      const expectedGeneration = generation;
      const abort = new AbortController();
      let controller: PanelController | null = null;
      try {
        const launcherPath = await catalogExecutable(process.pid, abort.signal);
        const installation = await installedRuntime({ launcherPath });
        const nodePath = process.env["OMO_ROUTE_PANEL_NODE_PATH"] ?? (await runProcess({
          executable: "node", args: ["-p", "process.execPath"], cwd: homedir(),
          env: { PATH: process.env["PATH"] ?? "/usr/bin:/bin" }, input: "", timeoutMs: 5000, signal: abort.signal,
        })).trim();
        const adapter = createNativeAdapter({
          home: homedir(), agentDir: ctx.agentDir, launcherPath,
          runtimeRoot: installation.runtimeRoot, nodePath, signal: abort.signal,
          host: {
            catalog: async () => {
              if (generation !== expectedGeneration || abort.signal.aborted) return { status: "unknown", code: "host-retired" };
              try { return catalogSnapshot(await ctx.modelRegistry.modelRuntime.getAvailable()); }
              catch (error) {
                if (!(error instanceof Error)) throw error;
                return { status: "unknown", code: "host-catalog-failed" };
              }
            },
            verify: async (engine) => {
              if (generation !== expectedGeneration || abort.signal.aborted) throw new NativeError("host-retired");
              if (engine.launcherDigest !== installation.launcherDigest || engine.runtimeRoot !== installation.runtimeRoot
                || !await verifyCatalogExecutable(process.pid, installation.launcherDigest, abort.signal)) {
                throw new NativeError("host-installation-changed");
              }
            },
          },
        });
        controller = createPanelController({
          home: homedir(), project: ctx.cwd, registryContext: ctx.cwd, adapter,
          ...(process.env["OMO_PROFILE"] ? { profile: process.env["OMO_PROFILE"] } : {}),
          signal: abort.signal, reload: () => ctx.reload(),
          notifySave: (message, status) => ctx.ui.notify(message, status === "saved" ? "info" : "error"),
        });
        await controller.read("user");
        if (expectedGeneration !== generation) throw new PanelError("host-retired", "The host reloaded while opening. Reopen Route Panel.");
        const panel = controller;
        await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
          active = { controller: panel, abort, done: () => done() };
          return createPanelComponent(panel, {
            requestRender: () => tui.requestRender(),
            done: () => done(),
            rows: () => Math.max(4, tui.terminal.rows - 2),
            wrap: wrapTextWithAnsi,
            hasProject: ctx.cwd !== homedir(),
            theme: {
              accent: (text) => theme.fg("accent", text),
              muted: (text) => theme.fg("muted", text),
              error: (text) => theme.fg("error", text),
            },
            key: (data) => {
              const names = [
                ["up", "up"], ["down", "down"], ["enter", "enter"], ["escape", "escape"],
                ["pageUp", "pageup"], ["pageDown", "pagedown"], ["home", "home"], ["end", "end"],
                ["left", "left"], ["right", "right"], ["delete", "delete"], ["tab", "tab"],
                ["backspace", "backspace"], ["ctrl+u", "clear"], ["f1", "more"], ["f4", "changes"],
                ["ctrl+s", "apply"], ["ctrl+c", "close"],
              ] as const;
              return names.find(([name]) => matchesKey(data, name))?.[1] ?? data;
            },
          });
        });
      } catch (error) {
        if (error instanceof Error && expectedGeneration === generation) {
          ctx.ui.notify(error instanceof PanelError ? error.message : "Route Panel could not verify the host installation, model registry or configuration.", "error");
        } else if (!(error instanceof Error)) throw error;
      } finally {
        controller?.close();
        abort.abort();
        release(controller);
        opening = false;
      }
    },
  });
}
