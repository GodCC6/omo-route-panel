/** Synthetic host instrumentation. No personal configuration or inference. */
import { createConnection } from "node:net";
import type { Socket } from "node:net";
import { createInterface } from "node:readline";
import { extension as sourcePanel } from "../src/extension.js";
import type { HostAPI, HostContext } from "../src/extension.js";
import type { PanelComponent } from "../src/tui.js";

const installedEntry = process.env["OMO_ROUTE_PANEL_TEST_ENTRY"];
let panel: typeof sourcePanel = sourcePanel;
if (installedEntry) {
  const candidate: unknown = (await import(installedEntry)).default;
  if (typeof candidate !== "function") throw new Error("The packed extension must default-export its factory.");
  panel = (api) => { candidate(api); };
}

interface FixtureAPI extends Omit<HostAPI, "on"> {
  on(name: string, callback: (event: { readonly reason?: string }, context: HostContext) => Promise<void> | void): void;
  registerProvider(name: string, config: unknown): void;
  readonly events: { on(name: string, callback: (data: unknown) => void): void };
}

export function extension(api: FixtureAPI): void {
  let socket: Socket | undefined;
  let generation = 0;
  let commandContext: HostContext | null = null;
  let failNextReload = false;
  let driftCatalog = false;
  const queued: Record<string, unknown>[] = [];
  const emit = (event: Record<string, unknown>): void => {
    if (!socket?.writable) { queued.push(event); return; }
    socket.write(`${JSON.stringify({ ...event, generation })}\n`);
  };
  api.registerProvider("fixture", {
    api: "openai-completions", baseUrl: "http://127.0.0.1:1", apiKey: "SYNTHETIC_TUI_ONLY",
    models: ["one", "two", "fixture/nested"].map((id) => ({
      id, name: id, reasoning: true, input: ["text"], contextWindow: 200000, maxTokens: 1024,
      cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
    })),
    streamSimple: () => { emit({ type: "inference-forbidden" }); throw new Error("No inference allowed."); },
  });
  api.on("agent_start", () => { emit({ type: "inference-forbidden" }); throw new Error("No agent turn allowed."); });
  api.events.on("config-watch:ready", () => emit({ type: "watch-ready" }));
  api.on("session_start", (event, ctx) => {
    generation++;
    const path = process.env["TUI_EVENTS"];
    if (!path) throw new Error("Missing synthetic event socket.");
    socket = createConnection(path);
    createInterface({ input: socket }).on("line", (line) => {
      if (line === "fail-next-reload") {
        failNextReload = true;
        emit({ type: "armed", control: line });
      }
      if (line === "drift-catalog" || line === "restore-catalog") {
        driftCatalog = line === "drift-catalog";
        emit({ type: "armed", control: line });
      }
      if (line === "reload" && commandContext) {
        emit({ type: "reload-requested" });
        void commandContext.reload().catch(() => emit({ type: "reload-failed" }));
      }
    });
    socket.once("connect", () => {
      for (const item of queued.splice(0)) emit(item);
      emit({ type: "ready", reason: event.reason, pid: process.pid, cwd: ctx.cwd, agentDir: ctx.agentDir });
    });
  });
  const instrumented: HostAPI = {
    on: (name, callback) => api.on(name, callback),
    registerCommand: (name, command) => api.registerCommand(name, {
      ...command,
      handler: (args, ctx) => command.handler(args, {
        ...ctx,
        reload: async () => {
          if (failNextReload) {
            failNextReload = false;
            throw new Error("Synthetic reload failure");
          }
          await ctx.reload();
        },
        modelRegistry: { modelRuntime: { getAvailable: async () => {
          const models = await ctx.modelRegistry.modelRuntime.getAvailable();
          return driftCatalog ? models.map((model) => ({ ...model, name: `${model.name ?? model.id} drift` })) : models;
        } } },
        ui: {
          ...ctx.ui,
          notify: (message, type) => { emit({ type: "notice", message, severity: type }); ctx.ui.notify(message, type); },
          custom: (factory) => ctx.ui.custom((tui, theme, bindings, done) => {
            if (process.env["TUI_CONTEXT_CAPTURE"] === "1") ctx.ui.notify("HOST_CONTEXT_BEFORE_ROUTE_PANEL", "info");
            commandContext = ctx;
            let component: PanelComponent | undefined;
            let inputId = 0;
            const wrapped = new Proxy(tui, {
              get(target, property) {
                if (property === "requestRender") return () => {
                  target.requestRender();
                  const requestedBy = inputId;
                  queueMicrotask(() => { if (component) emit({ type: "frame", inputId: requestedBy, lines: component.render(tui.terminal.columns), cols: tui.terminal.columns, rows: tui.terminal.rows }); });
                };
                return Reflect.get(target, property, target);
              },
            });
            component = factory(wrapped, theme, bindings, done);
            emit({ type: "open", inputId, lines: component.render(tui.terminal.columns) });
            const current = component;
            return {
              render: (width) => current.render(width),
              handleInput: (data) => { inputId++; current.handleInput(data); emit({ type: "input", inputId, key: data }); },
              invalidate: () => current.invalidate(),
              dispose: () => { current.dispose(); emit({ type: "closed" }); },
            };
          }),
        },
      }),
    }),
  };
  panel(instrumented);
  api.registerCommand("rp-quit", {
    description: "Quit the isolated test host",
    handler: async (_args, ctx) => {
      const candidate: unknown = ctx;
      if (typeof candidate === "object" && candidate !== null && "shutdown" in candidate && typeof candidate.shutdown === "function") candidate.shutdown();
    },
  });
  api.on("session_shutdown", (event) => { commandContext = null; emit({ type: "shutdown", reason: event.reason }); socket?.end(); });
}
