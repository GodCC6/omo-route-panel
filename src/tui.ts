import { sliceByColumn, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { parse } from "jsonc-parser";
import type { PanelController } from "./tui-contract.js";
import type { BackgroundRoute, Candidate, Json, Operation } from "./types.js";
import { reasoningLevels } from "./validation.js";
import { NATIVE_MODEL_PROFILES } from "./native/index.js";
import { declaredModelProfiles } from "./presentation.js";
import type { PresentedRoute } from "./presentation.js";

export type PanelEnvironment = {
  readonly requestRender: () => void;
  readonly done: () => void;
  readonly rows: () => number;
  readonly wrap: (text: string, width: number) => readonly string[];
  readonly hasProject?: boolean;
  readonly theme?: {
    readonly accent?: (text: string) => string;
    readonly muted?: (text: string) => string;
    readonly error?: (text: string) => string;
  };
  readonly key?: (data: string) => string;
};
export interface PanelComponent {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
  dispose(): void;
}

type Search = { value: string; cursor: number };
type Row = {
  readonly id: string;
  readonly label: string;
  readonly value?: string;
  readonly description?: string;
  readonly search?: string;
  readonly group?: string;
  readonly action?: boolean;
  readonly hint?: string;
  readonly unavailable?: string;
  readonly choose: () => void;
  readonly toggle?: () => void;
};
type Main = { readonly kind: "main"; index: number; scroll: number; readonly search: Search };
type Chain = {
  readonly kind: "chain"; readonly route: PresentedRoute; readonly parent: Screen;
  readonly original: readonly Candidate[]; models: readonly Candidate[];
  inherit: boolean; index: number; scroll: number;
};
type List = {
  readonly kind: "list"; readonly title: string; readonly parent: Screen;
  readonly rows: () => readonly Row[]; readonly search?: Search;
  readonly pending?: boolean; readonly picker?: boolean;
  index: number; scroll: number;
};
type Input = {
  readonly kind: "input"; readonly title: string; readonly parent: Screen;
  readonly search: Search; readonly accept: (value: string) => void;
};
type Details = {
  readonly kind: "details"; readonly title: string; readonly parent: Screen;
  readonly content: () => readonly string[]; scroll: number;
};
type Compare = {
  readonly kind: "compare"; readonly chain: Chain; readonly parent: Screen;
  index: number; scroll: number;
};
type Changes = { readonly kind: "changes"; readonly parent: Screen; index: number; scroll: number };
type Screen = Main | Chain | List | Input | Details | Compare | Changes;
const keyNames: Readonly<Record<string, string>> = {
  "\r": "enter", "\n": "enter", "\u001b": "escape", "\u007f": "backspace", "\b": "backspace",
  "\u001b[A": "up", "\u001b[B": "down", "\u001b[C": "right", "\u001b[D": "left",
  "\u001b[5~": "pageup", "\u001b[6~": "pagedown", "\u001b[H": "home", "\u001b[F": "end",
  "\u001b[3~": "delete", "\u0013": "apply", "\u0003": "close", "\u0015": "clear",
  "\t": "tab", "\u001bOP": "more", "\u001bOS": "changes",
};
const chars = (value: string): string[] => Array.from(value);
const control = (char: string): boolean => char.charCodeAt(0) < 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159);
const printable = (value: string): boolean => value.length > 0 && !chars(value).some(control);
const safe = (value: string): string => chars(value).map((char) => control(char) ? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}` : char).join("");
const sameChain = (a: readonly Candidate[], b: readonly Candidate[]): boolean =>
  JSON.stringify(a.map(({ model, reasoning }) => ({ model, reasoning }))) === JSON.stringify(b.map(({ model, reasoning }) => ({ model, reasoning })));
const declared = (value: Json | undefined): string => value === undefined ? "Inherit" : typeof value === "string" ? value : String(value);
const compactDeclaration = (value: string): string => {
  const parsed: unknown = parse(value);
  return JSON.stringify(parsed) ?? value;
};

/** One mounted native-file buffer; child chain forms are deliberately unaccepted. */
export function createPanelComponent(controller: PanelController, environment: PanelEnvironment): PanelComponent {
  const sections = {
    routes: { kind: "main", index: 0, scroll: 0, search: { value: "", cursor: 0 } },
    background: { kind: "main", index: 0, scroll: 0, search: { value: "", cursor: 0 } },
  } satisfies Record<string, Main>;
  let section: "routes" | "background" = "routes";
  let screen: Screen = sections.routes;
  let busy = false;
  let applying = false;
  let disposed = false;
  let message = "";
  let failure = false;
  let pageSize = 5;
  let selectedSpan = 1;
  let pagingBody = false;
  let reopenNeeded = false;
  let savedScope = controller.view?.scope ?? "user";
  const redraw = (): void => { if (!disposed) environment.requestRender(); };
  const notify = (text: string, error = false): void => { message = text; failure = error; redraw(); };
  const routes = (): readonly PresentedRoute[] => controller.editor?.routes ?? controller.view?.routes ?? [];
  const tasks = (): readonly BackgroundRoute[] => (controller.editor?.background ?? controller.view?.background ?? [])
    .filter((task) => ["recall", "reflection", "dream", "facts", "nudge", "sync"].includes(task.id));
  const fields = (): Readonly<Record<string, Json>> => controller.editor?.fields ?? controller.view?.fields ?? {};
  const fieldValue = (name: string): Json | undefined => fields()[`native:${name}`] ?? fields()[name];
  const opKey = (op: Operation): string => {
    switch (op.kind) {
      case "set-chain": case "remove-override": return `${op.target}:${op.id}`;
      case "set-field": case "remove-field": return op.field;
    }
  };
  const changeKey = (path: string): string => {
    const parts = path.replace(/^\[native\]\.?/, "").split(".");
    if (parts[0] === "categories" || parts[0] === "agents") return `${parts[0] === "categories" ? "category" : "agent"}:${parts[1] ?? ""}`;
    return parts.slice(0, parts[0] === "memory" ? 2 : 1).join(".");
  };
  const changedKeys = (): ReadonlySet<string> => new Set((controller.editor?.changes ?? []).map((change) => changeKey(change.path)));
  const dirty = (): boolean => (controller.editor?.changes.length ?? 0) > 0;
  const count = (): number => changedKeys().size;
  const localDirty = (chain: Chain): boolean => chain.inherit ? chain.route.override !== null : !sameChain(chain.original, chain.models);
  const run = (action: () => Promise<void>): void => {
    if (busy || disposed) return;
    busy = true; redraw();
    void (async () => {
      try { await action(); }
      catch (error) {
        if (!(error instanceof Error)) throw error;
        if (!disposed) { message = error.message; failure = true; }
      } finally { if (!disposed) { busy = false; applying = false; redraw(); } }
    })();
  };
  const begin = (): boolean => {
    if (controller.editor?.undo) { notify("Apply or cancel the prepared undo first.", true); return false; }
    if (!controller.editor) controller.begin("native");
    return true;
  };
  const change = (updates: readonly Operation[], accepted: () => void, rejected?: Screen): void => {
    if (!begin()) return;
    const replaced = new Set(updates.map(opKey));
    const operations = [...(controller.editor?.operations ?? []).filter((op) => !replaced.has(opKey(op))), ...updates];
    run(async () => {
      try { await controller.change(operations); }
      catch (error) { if (rejected && !disposed) screen = rejected; throw error; }
      if (disposed) return;
      accepted(); message = ""; failure = false;
    });
  };
  const main = (): void => { screen = sections[section]; };
  const changes = (): void => { screen = { kind: "changes", parent: sections[section], index: 0, scroll: 0 }; };
  const close = (): void => {
    if (disposed) return;
    disposed = true; controller.cancel(); controller.close(); environment.done();
  };
  const cancel = (): void => { controller.cancel(); message = ""; failure = false; main(); };
  const action = (label: string, choose: () => void, unavailable?: string): Row => ({
    id: label, label, action: true, choose, ...(unavailable ? { unavailable } : {}),
  });
  const menu = (title: string, rows: () => readonly Row[], parent = screen, searchable = false, pending = false): void => {
    screen = { kind: "list", title, rows, parent, index: 0, scroll: 0,
      ...(searchable ? { search: { value: "", cursor: 0 }, picker: true } : {}), ...(pending ? { pending } : {}) };
  };
  const details = (title: string, content: () => readonly string[]): void => {
    screen = { kind: "details", title, parent: screen, content, scroll: 0 };
  };
  const guard = (callback: () => void): void => {
    if (dirty()) { notify("Apply or discard changes first.", true); return; }
    if (controller.editor) controller.cancel();
    callback();
  };
  const discard = (closing: boolean): void => {
    menu(`Discard ${count()} unsaved changes?`, () => [
      action("Keep editing", main),
      action(closing ? "Discard & close" : "Discard changes", () => { cancel(); if (closing) close(); }),
    ]);
  };
  const pending = (current: Screen): boolean => {
    switch (current.kind) {
      case "main": case "changes": return false;
      case "input": return true;
      case "chain": return localDirty(current);
      case "list": return current.pending === true || pending(current.parent);
      case "details": case "compare": return pending(current.parent);
    }
  };
  const apply = (): void => {
    if (screen.kind !== "main" && screen.kind !== "changes") {
      if (pending(screen)) notify("Accept or cancel this edit first", true);
      else if (dirty()) changes();
      return;
    }
    if (!dirty()) return;
    applying = true;
    savedScope = controller.view?.scope ?? savedScope;
    run(async () => {
      const outcome = await controller.apply();
      if (disposed) return;
      main(); message = outcome.message; failure = outcome.status === "saved-reload-failed"; reopenNeeded = failure;
    });
  };
  const undo = (): void => guard(() => run(async () => { await controller.undo(); if (!disposed) changes(); }));
  const more = (): void => menu("More", () => [
    action("Change scope", () => menu("Scope", () => [
      action("User", () => guard(() => run(async () => { await controller.read("user"); main(); }))),
      action("Current project", () => guard(() => run(async () => { await controller.read("project"); main(); })), environment.hasProject ? undefined : "No current project"),
    ]), dirty() ? "Apply or discard changes first" : undefined),
    action("Refresh", () => guard(() => run(async () => { await controller.read(controller.view?.scope ?? "user"); main(); })), dirty() ? "Apply or discard changes first" : undefined),
    ...(dirty() ? [action("Inspect changes", changes), action("Discard all changes", () => discard(false))] : []),
    ...(!dirty() && controller.view?.canUndo ? [action("Undo last save", undo)] : []),
    ...(controller.view?.undoUnavailableReason ? [action("Undo unavailable", () => notify(controller.view?.undoUnavailableReason ?? "", true), controller.view.undoUnavailableReason)] : []),
    ...(failure ? [action("Error details...", () => details("Operation failed", () => [message])),
      action("Dismiss error", () => { message = ""; failure = false; main(); })] : []),
    ...(reopenNeeded ? [action("Reopen", () => run(async () => {
      await controller.read(savedScope); reopenNeeded = false; message = ""; failure = false; main();
    }))] : []),
  ]);
  const modelPicker = (select: (reference: string) => void, inherit?: () => void, selectedReference?: string): void => {
    menu("Choose model", () => [
      ...(inherit ? [action("Inherit", inherit)] : []),
      ...(selectedReference && !controller.view?.catalog.models.some((model) => `${model.provider}/${model.id}` === selectedReference) ? [{
        id: selectedReference, label: selectedReference, value: "Unavailable",
        description: "Saved user declaration; absent from the current host model catalog.",
        unavailable: "Select an available model or Inherit", choose: () => {},
      }] : []),
      ...(controller.view?.catalog.models ?? []).map((model): Row => ({
        id: `${model.provider}/${model.id}`, label: `${model.provider}/${model.id}`,
        search: `${model.provider}/${model.id} ${model.name ?? ""}`,
        description: `${model.provider}/${model.id}`,
        choose: () => select(`${model.provider}/${model.id}`),
      })),
    ], screen, true, true);
    if (screen.kind === "list") screen.index = Math.max(0, screen.rows().findIndex((row) => row.id === (selectedReference ?? "Inherit")));
  };
  const chooseField = (field: string, title: string): void => {
    if (!begin()) return;
    const parent = screen;
    const set = (value?: Json): void => change([value === undefined
      ? { kind: "remove-field", group: "native", field }
      : { kind: "set-field", group: "native", field, value }], () => { screen = parent; }, parent);
    if (field.endsWith(".model")) { modelPicker(set, () => set(), typeof fieldValue(field) === "string" ? String(fieldValue(field)) : undefined); return; }
    const options: readonly Json[] = field.endsWith(".enabled") ? [true, false]
      : field === "model_profile" ? [...new Set([...NATIVE_MODEL_PROFILES, ...(controller.view ? declaredModelProfiles(controller.view.inspection, controller.view.resolution.effective.report.configProfile) : [])])]
        : routes().filter((route) => route.kind === "category").map((route) => route.id);
    menu(title, () => [undefined, ...options].map((value): Row => ({
      id: declared(value), label: value === true ? "Enabled" : value === false ? "Disabled" : declared(value),
      value: fieldValue(field) === value ? "Selected" : "", choose: () => set(value),
    })), parent, !field.endsWith(".enabled"), true);
    if (screen.kind === "list") screen.index = Math.max(0, [undefined, ...options].findIndex((value) => value === fieldValue(field)));
  };
  const backToChanges = (unavailable?: string): readonly Row[] => dirty() ? [action("Back to changes", changes, unavailable)] : [];
  const taskFields = (id: string): readonly string[] => {
    switch (id) {
      case "recall": case "reflection": return [`memory.${id}.enabled`, `memory.${id}.category`];
      case "facts": return ["memory.facts.enabled", "memory.facts.model"];
      case "dream": return ["memory.dream.enabled"];
      default: return [];
    }
  };
  const taskEditor = (id: string): void => {
    const selected = tasks().find((task) => task.id === id);
    if (!selected) return;
    menu(selected.title, () => {
      const task = tasks().find((item) => item.id === id) ?? selected;
      return [
        ...taskFields(id).map((field): Row => ({
          id: field, label: field.endsWith("enabled") ? "Enabled" : field.endsWith("category") ? "Category" : "Model",
          value: declared(fieldValue(field)),
          description: field.endsWith("enabled") ? `Effective: ${task.enabled === null ? "unverified" : task.enabled}; ${task.stateSource}`
            : `Effective: ${task.category ?? task.model ?? task.modelStrategy}; ${task.bindingSource ?? "Binding source unverified"}; ${task.policy}`,
          choose: () => chooseField(field, field.endsWith("enabled") ? "Enabled" : field.endsWith("category") ? "Category" : "Model"),
          ...(field.endsWith("enabled") ? { toggle: () => {
            if (task.enabled === null) { notify("Effective switch is unverified; choose an explicit value with Enter.", true); return; }
            const parent = screen;
            change([{ kind: "set-field", group: "native", field, value: !task.enabled }], () => { screen = parent; });
          } } : {}),
        })),
        ...(id === "nudge" || id === "sync" ? [{
          id: "local", label: "Local processing", value: "Read only", description: `${task.stateSource} ${task.policy}`,
          hint: "view", choose: () => details(task.title, () => [task.stateSource, task.policy]),
        }] : [action(task.candidates.length ? "Effective candidates..." : task.modelStrategy === "fixed" ? "Binding details..." : "Strategy details...",
          () => details(task.title, () => [`Strategy: ${task.modelStrategy}${task.category ? ` / ${task.category}` : ""}`,
            ...(task.bindingSource ? [`Binding source: ${task.bindingSource}`] : []),
            ...(task.model ? [`Binding: ${task.model}`] : []), ...task.candidates.map((candidate, index) => `${index + 1}. ${candidate.model}`), task.policy]))]),
        ...backToChanges(), action("Back to main", main),
      ];
    });
  };
  const candidateMenu = (chain: Chain, index: number): void => {
    const candidate = chain.models[index];
    if (!candidate) return;
    const update = (models: readonly Candidate[], next = index): void => {
      chain.models = models; chain.inherit = false; chain.index = Math.max(0, Math.min(next, models.length - 1)); screen = chain;
    };
    menu(`Candidate ${index + 1}`, () => [
      action("Replace model", () => modelPicker((model) => update(chain.models.map((item, i) => i === index ? { model, ...(item.reasoning ? { reasoning: item.reasoning } : {}) } : item)), undefined, candidate.model)),
      action("Reasoning", () => menu("Candidate reasoning", () => [undefined, ...reasoningLevels].map((reasoning): Row => ({
        id: reasoning ?? "inherit", label: reasoning ?? "Inherit", value: candidate.reasoning === reasoning ? "Selected" : "",
        description: "Candidate override; Inherit omits this declaration, retaining route-level reasoning.",
        choose: () => update(chain.models.map((item, i) => i === index ? { model: item.model, ...(reasoning ? { reasoning } : {}) } : item)),
      })), screen, false, true)),
      ...([-1, 1] as const).map((delta) => action(delta === -1 ? "Move earlier" : "Move later", () => {
        const models = [...chain.models]; models.splice(index, 1); models.splice(index + delta, 0, candidate); update(models, index + delta);
      }, index + delta < 0 || index + delta >= chain.models.length ? "Already at boundary" : undefined)),
      action("Remove", () => update(chain.models.filter((_, i) => i !== index)), chain.models.length <= 1 ? "Keep one candidate or restore inheritance" : undefined),
    ], chain, false, localDirty(chain));
  };
  const compareNames = (): readonly string[] => dirty()
    ? ["Proposed effective", "Saved effective", "Saved user override", "Upstream"]
    : ["Saved effective", "Saved user override", "Upstream"];
  const chainRows = (chain: Chain): readonly Row[] => {
    const changed = localDirty(chain);
    return [
      ...chain.models.map((candidate, index): Row => {
        const available = controller.view?.catalog.models.some((model) => `${model.provider}/${model.id}` === candidate.model);
        return {
          id: String(index), label: `${index + 1}  ${candidate.model}`, value: candidate.reasoning ?? "inherit",
          description: `${candidate.model} / Candidate reasoning: ${candidate.reasoning ?? "Inherit"}${available ? "" : " / Unavailable in host catalog"}`,
          choose: () => candidateMenu(chain, index),
        };
      }),
      action("Add candidate...", () => modelPicker((model) => {
        chain.models = [...chain.models, { model }]; chain.inherit = false; chain.index = chain.models.length - 1; screen = chain;
      })),
      action("Compare recommendation / override / effective...", () => {
        screen = { kind: "compare", chain, parent: chain, index: 0, scroll: 0 };
      }, changed ? "Accept or cancel local changes first" : undefined),
      action("Restore chain inheritance", () => {
        chain.inherit = true; chain.models = chain.original; chain.index = chain.models.length + 2;
      }),
      action("Use chain", () => change([chain.inherit
        ? { kind: "remove-override", group: "native", target: chain.route.kind, id: chain.route.id }
        : { kind: "set-chain", group: "native", target: chain.route.kind, id: chain.route.id, models: chain.models }], main), changed ? undefined : "No local changes"),
      action("Route reasoning declarations...", () => details("Route reasoning declarations", () => [
        ...Object.entries(chain.route.routeReasoning ?? {}).map(([name, value]) => `${name}: ${declared(value)}`),
        ...(Object.keys(chain.route.routeReasoning ?? {}).length ? [] : ["No user route-level reasoning declaration"]),
        "Candidate Inherit omits its reasoning override. Remaining native layers decide; this is not a confirmed effective reasoning level.",
      ])),
      ...backToChanges(changed ? "Accept or cancel local changes first" : undefined),
    ];
  };
  const newCategory = (): void => {
    if (!begin()) return;
    const input: Input = { kind: "input", title: "New category name", parent: screen, search: { value: "", cursor: 0 }, accept: (id) => {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id) || ["constructor", "prototype", "__proto__"].includes(id)) {
        notify("Use letters, digits, underscores and hyphens.", true); return;
      }
      if ([...(controller.view?.routes ?? []), ...routes()].some((route) => route.kind === "category" && route.id === id)) {
        menu("Already exists", () => [action("Locate category", () => {
          section = "routes"; const state = sections.routes; state.search.value = id; state.search.cursor = chars(id).length; state.index = 0; main();
        }), action("Back to name", () => { screen = input; })], input);
        return;
      }
      modelPicker((model) => change([{ kind: "set-chain", group: "native", target: "category", id, models: [{ model }] }], main));
    } };
    screen = input;
  };
  const mainRows = (): readonly Row[] => {
    const edited = changedKeys();
    const configuration: readonly Row[] = section === "routes" ? [
      ...[...routes().filter((route) => route.kind === "category"), ...routes().filter((route) => route.kind === "agent")].map((route): Row => ({
        id: `${route.kind}:${route.id}`, label: `${route.id}${edited.has(`${route.kind}:${route.id}`) ? " *" : ""}`,
        group: route.kind === "category" ? "Categories" : "Agents",
        value: route.status !== "resolved" ? route.status : route.override === null ? "Inherited"
          : `${route.effective[0]?.model ?? "No candidates"}${route.effective.length > 1 ? ` +${route.effective.length - 1}` : ""}`,
        search: `${route.id} ${route.kind} ${[...route.effective, ...route.override ?? [], ...route.defaults].map((candidate) => candidate.model).join(" ")}`,
        description: `${route.id} / ${route.kind} - ${route.status}; ${route.override === null ? "Inherited" : "User override"}, ${route.effective.length} effective candidates`,
        hint: "edit", choose: () => {
          if (!begin()) return;
          const original = route.override ?? route.effective.map(({ model }) => ({ model }));
          screen = { kind: "chain", route, original, models: original, inherit: false, parent: screen, index: 0, scroll: 0 };
        },
      })),
      { id: "profile", label: `Model profile${edited.has("model_profile") ? " *" : ""}`, value: declared(fieldValue("model_profile")),
        description: "Native routing model profile / user declaration", hint: "edit", choose: () => chooseField("model_profile", "Model profile") },
    ] : tasks().map((task): Row => ({
      id: task.id, label: `${task.title}${edited.has(`memory.${task.id}`) ? " *" : ""}`,
      value: task.enabled === null ? "Unverified" : task.enabled ? "Enabled" : "Disabled",
      search: `${task.title} ${task.id} ${task.category ?? ""} ${task.model ?? ""}`,
      description: `${task.modelStrategy}${task.category ? ` / ${task.category}` : ""}; ${task.stateSource} ${task.policy}`,
      hint: taskFields(task.id).length ? "edit" : "view", choose: () => taskEditor(task.id),
    }));
    const query = sections[section].search.value.toLocaleLowerCase();
    return [
      ...configuration.filter((row) => `${row.search ?? row.label}`.toLocaleLowerCase().includes(query)),
      ...(section === "routes" ? [action("Add category...", newCategory, controller.editor?.undo ? "Apply or cancel prepared undo first" : undefined)] : []),
      action("More...", more),
      ...(dirty() ? [action(`Apply (${count()})`, apply), action("Changes", changes)] : []),
      ...(!dirty() && controller.view?.canUndo ? [action("Undo last save", undo)] : []),
    ];
  };
  const rowsFor = (current: Main | Chain | List): readonly Row[] => {
    switch (current.kind) {
      case "main": return mainRows();
      case "chain": return chainRows(current);
      case "list": {
        const query = current.search?.value.toLocaleLowerCase() ?? "";
        return current.rows().filter((row) => `${row.search ?? row.label}`.toLocaleLowerCase().includes(query))
          .map((row) => ({ ...row, action: false }));
      }
    }
  };
  const editSearch = (search: Search, key: string): boolean => {
    const text = chars(search.value);
    switch (key) {
      case "left": search.cursor = Math.max(0, search.cursor - 1); return true;
      case "right": search.cursor = Math.min(text.length, search.cursor + 1); return true;
      case "home": search.cursor = 0; return true;
      case "end": search.cursor = text.length; return true;
      case "clear": search.value = ""; search.cursor = 0; return true;
      case "backspace": if (search.cursor) text.splice(--search.cursor, 1); break;
      case "delete": text.splice(search.cursor, 1); break;
      default: return false;
    }
    search.value = text.join(""); return true;
  };
  const comparison = (current: Compare): readonly string[] => {
    const name = compareNames()[current.index] ?? "Saved effective";
    const saved = controller.view?.routes.find((route) => route.kind === current.chain.route.kind && route.id === current.chain.route.id);
    const proposed = routes().find((route) => route.kind === current.chain.route.kind && route.id === current.chain.route.id);
    const route = name === "Proposed effective" ? proposed : saved;
    const candidates = name === "Saved user override" ? saved?.override : name === "Upstream" ? saved?.defaults : route?.effective;
    return [
      ...(name === "Saved user override" && candidates === null ? ["Inherited: no explicit user chain"] : []),
      ...(route ? [`State: ${route.status}`] : []),
      ...(candidates ?? []).map((candidate, index) => `${index + 1}. ${candidate.model}${candidate.reasoning ? ` / candidate reasoning: ${candidate.reasoning}` : ""}${candidate.status ? ` / ${candidate.status}` : ""}`),
      ...(!candidates?.length ? ["No candidates"] : []),
      ...(route?.diagnostics ?? []),
    ];
  };
  const component: PanelComponent = {
    invalidate: redraw,
    dispose() { if (disposed) return; disposed = true; controller.cancel(); controller.close(); },
    handleInput(data) {
      if (disposed || busy) return;
      const paste = data.startsWith("\u001b[200~");
      if (paste || printable(data)) {
        pagingBody = false;
        const current = screen;
        if (!paste && data === " " && current.kind === "list" && !current.search) {
          rowsFor(current)[current.index]?.toggle?.();
        } else {
          const search = current.kind === "input" || current.kind === "main" || current.kind === "list" ? current.search : undefined;
          if (search) {
            const text = paste ? data.slice(6, data.endsWith("\u001b[201~") ? -6 : undefined).replace(/[\r\n\t]/g, " ") : data;
            const value = chars(search.value);
            value.splice(search.cursor, 0, ...chars(text));
            search.value = value.join(""); search.cursor += chars(text).length;
            if (current.kind === "main" || current.kind === "list") { current.index = 0; current.scroll = 0; }
          }
        }
        redraw(); return;
      }
      const key = environment.key?.(data) ?? keyNames[data] ?? data;
      if (key !== "pageup" && key !== "pagedown") pagingBody = false;
      if (key === "close") { if (dirty()) discard(true); else close(); redraw(); return; }
      if (key === "apply") { apply(); redraw(); return; }
      if (key === "more" && screen.kind === "main") { more(); redraw(); return; }
      if (key === "changes" && (screen.kind === "main" || screen.kind === "changes")) {
        if (screen.kind === "changes") main(); else if (dirty()) changes(); redraw(); return;
      }
      const current = screen;
      switch (current.kind) {
        case "input":
          if (key === "escape") screen = current.parent;
          else if (key === "enter") current.accept(current.search.value);
          else editSearch(current.search, key);
          break;
        case "main": case "chain": case "list": {
          const rows = rowsFor(current);
          const row = rows[current.index];
          if (key === "escape") {
            if (current.kind === "main") {
              if (current.search.value) {
                const id = row?.action ? undefined : row?.id;
                current.search.value = ""; current.search.cursor = 0;
                current.index = Math.max(0, id ? rowsFor(current).findIndex((item) => item.id === id) : 0); current.scroll = 0;
              } else if (dirty()) discard(true); else close();
            } else screen = current.parent;
          } else if (key === "tab" && current.kind === "main") { section = section === "routes" ? "background" : "routes"; main(); }
          else if (["up", "down", "pageup", "pagedown"].includes(key)) {
            if (current.kind !== "main" && selectedSpan > pageSize && (key === "pageup" || key === "pagedown")) {
              pagingBody = true; current.scroll = Math.max(0, current.scroll + (key === "pageup" ? -pageSize : pageSize));
            } else {
              pagingBody = false;
              const delta = key === "up" ? -1 : key === "down" ? 1 : key === "pageup" ? -pageSize : pageSize;
              current.index = Math.max(0, Math.min(rows.length - 1, current.index + delta));
            }
          } else if (key === "enter") {
            if (row?.unavailable) notify(row.unavailable, true); else row?.choose();
          } else if (key === " " && current.kind === "list" && !current.search && row?.toggle) row.toggle();
          else {
            const search = current.kind === "chain" ? undefined : current.search;
            if (search && editSearch(search, key)) {
              if (!["left", "right", "home", "end"].includes(key)) { current.index = 0; current.scroll = 0; }
            }
          }
          break;
        }
        case "compare":
          if (key === "escape") screen = current.parent;
          else if (key === "left" || key === "right") { current.index = Math.max(0, Math.min(compareNames().length - 1, current.index + (key === "left" ? -1 : 1))); current.scroll = 0; }
          else if (key === "enter") menu("Comparison view", () => compareNames().map((name, index) => action(name, () => { current.index = index; current.scroll = 0; screen = current; })));
          else if (key === "up" || key === "pageup") current.scroll = Math.max(0, current.scroll - (key === "up" ? 1 : pageSize));
          else if (key === "down" || key === "pagedown") current.scroll += key === "down" ? 1 : pageSize;
          break;
        case "details":
          if (key === "escape") screen = current.parent;
          else if (key === "up" || key === "pageup") current.scroll = Math.max(0, current.scroll - (key === "up" ? 1 : pageSize));
          else if (key === "down" || key === "pagedown") current.scroll += key === "down" ? 1 : pageSize;
          break;
        case "changes": {
          const keys = [...changedKeys()];
          if (key === "escape") main();
          else if (key === "up" || key === "down") { current.index = Math.max(0, Math.min(keys.length + 1, current.index + (key === "up" ? -1 : 1))); current.scroll = 0; }
          else if (key === "pageup" || key === "pagedown") current.scroll = Math.max(0, current.scroll + (key === "pageup" ? -pageSize : pageSize));
          else if (key === "enter" && current.index === keys.length) apply();
          else if (key === "enter" && current.index === keys.length + 1) main();
          break;
        }
      }
      redraw();
    },
    render(width) {
      if (disposed) return [];
      const w = Math.max(1, Math.min(84, Math.floor(width)));
      const totalHeight = Math.max(1, Math.min(20, Math.floor(environment.rows())));
      const compact = w <= 40 || totalHeight <= 12;
      const height = Math.max(1, totalHeight - (compact ? 0 : 2));
      const titleWidth = compact ? Math.max(1, w - 2) : w;
      // Sanitize configuration text once, before host helpers can introduce SGR.
      const clip = (text: string, cells = w): string => truncateToWidth(text, Math.max(1, cells), cells >= 4 ? "..." : "");
      const muted = (text: string): string => environment.theme?.muted?.(text) ?? text;
      const focus = (text: string): string => environment.theme?.accent?.(text) ?? text;
      const wrapped = (text: string): readonly string[] => environment.wrap(text, w).flatMap((line) =>
        visibleWidth(line) <= w ? [line] : Array.from({ length: Math.ceil(visibleWidth(line) / w) }, (_, i) => sliceByColumn(line, i * w, w)));
      const current = screen;
      const output: string[] = [];
      let title = current.kind === "main" ? `Routing  ${controller.view?.scope === "project" ? "Current project" : "User"}  ${section === "routes" ? "[Routes] Background" : "Routes [Background]"}`
        : current.kind === "chain" ? `${current.route.id} / ${current.route.kind}`
          : current.kind === "compare" ? `${current.chain.route.id} / Compare`
            : current.kind === "changes" ? "Changes" : current.title;
      const search = current.kind === "main" || current.kind === "input" || current.kind === "list" ? current.search : undefined;
      const inputLine = (value: Search, budget = w): string => {
        const text = chars(value.value);
        const before = text.slice(0, value.cursor).join("");
        const cursor = `${before}|${text.slice(value.cursor).join("")}`;
        const offset = Math.max(0, visibleWidth(before) - Math.max(1, budget - 4));
        return `> ${sliceByColumn(safe(cursor), offset, Math.max(1, budget - 2))}`;
      };
      title = safe(title);
      if (compact && search) {
        const context = current.kind === "main" ? section === "routes" ? "Routes" : "Background" : clip(title, Math.max(1, Math.floor(titleWidth / 2)));
        title = `${context} ${inputLine(search, titleWidth - visibleWidth(context) - 1)}`;
      }
      output.push(clip(title, titleWidth));
      if (search && !compact) output.push(clip(inputLine(search)));
      const status = applying ? "Applying..." : busy ? "Validating..." : message;
      let hint = "Enter choose | Esc back";
      let description = "";
      let body: string[] = [];
      let footer: string[] = [];
      if (current.kind === "main" || current.kind === "chain" || current.kind === "list") {
        const rows = rowsFor(current);
        current.index = Math.max(0, Math.min(rows.length - 1, current.index));
        const selected = rows[current.index];
        const resultRows = rows.filter((row) => !row.action);
        const actions = rows.filter((row) => row.action);
        const selectedResult = selected ? resultRows.indexOf(selected) : -1;
        const selectedAction = selected ? actions.indexOf(selected) : -1;
        output.push(clip(selectedAction >= 0 ? `Action ${selectedAction + 1}/${actions.length} | ${resultRows.length} results`
          : `${resultRows.length ? selectedResult + 1 : 0}/${resultRows.length} results`));
        description = selected?.unavailable ? `Unavailable: ${selected.unavailable}` : selected?.description ?? "";
        if (current.kind === "chain") description = `${localDirty(current) ? "Local changes - not yet accepted" : `${current.models.length} candidates - no local changes`}${description ? `; ${description}` : ""}`;
        if (current.kind === "main") {
          hint = `Type to search | Enter ${selected?.hint ?? (selected?.id === "Add category..." ? "add" : "choose")} | Tab section | Esc ${current.search.value ? "clear search" : dirty() ? "review discard" : "close"}`;
        } else if (current.kind === "list" && current.picker) hint = "Type to search | Ctrl-U clear | Esc cancel picker";
        else if (selected?.toggle) hint = "Space toggle | Enter choose | Esc back (keeps accepted edits)";
        const actionBudget = compact ? 1 : Math.min(3, actions.length);
        const descriptionBudget = compact ? 0 : description ? 2 : 0;
        const hintBudget = compact ? 1 : Math.min(2, wrapped(hint).length);
        const saveBudget = dirty() && !compact ? 1 : 0;
        const statusBudget = status ? 1 : 0;
        const bodyHeight = Math.max(1, Math.min(10, height - output.length - actionBudget - descriptionBudget - hintBudget - saveBudget - statusBudget));
        pageSize = bodyHeight;
        const visual: { readonly text: string; readonly selected: boolean }[] = [];
        let lastGroup: string | undefined;
        for (const row of resultRows) {
          if (bodyHeight > 3 && row.group && row.group !== lastGroup) { visual.push({ text: row.group, selected: false }); lastGroup = row.group; }
          const labelWidth = Math.max(1, Math.min(w - 6, Math.max(8, Math.min(30, Math.floor((w - 3) * 0.48)))));
          const prefix = row === selected ? "> " : "  ";
          const label = clip(safe(`${row.label}${compact && row === selected && row.group ? row.group === "Agents" ? " [agent]" : " [category]" : ""}`), labelWidth);
          const text = compact && current.kind === "main" && row === selected && row.group ? `${prefix}${clip(safe(row.label), w - 8)} [${row.group === "Agents" ? "agt" : "cat"}]`
            : row.value === undefined ? `${prefix}${safe(row.label)}` : current.kind === "chain" ? `${prefix}${safe(row.label)} / ${safe(row.value)}`
            : `${prefix}${label}${" ".repeat(Math.max(1, labelWidth - visibleWidth(label) + 2))}${safe(row.value)}`;
          const lines = current.kind === "main" ? [clip(text)] : wrapped(text);
          for (const line of lines) visual.push({ text: line, selected: row === selected });
        }
        const anchor = visual.findIndex((row) => row.selected);
        selectedSpan = visual.filter((row) => row.selected).length;
        if (!pagingBody && anchor >= 0 && (anchor < current.scroll || anchor >= current.scroll + bodyHeight)) current.scroll = anchor;
        if (pagingBody && anchor >= 0) current.scroll = Math.max(anchor, Math.min(current.scroll, anchor + Math.max(0, selectedSpan - bodyHeight)));
        current.scroll = Math.max(0, Math.min(current.scroll, Math.max(0, visual.length - bodyHeight)));
        body = visual.slice(current.scroll, current.scroll + bodyHeight).map((row) => row.selected ? focus(row.text) : row.text);
        if (!body.length) body = [muted(clip(resultRows.length ? "Choose an action below" : "No matches"))];
        if (actions.length) {
          const start = selectedAction >= 0 ? Math.max(0, Math.min(selectedAction, actions.length - actionBudget)) : 0;
          footer = actions.slice(start, start + actionBudget).map((row, i) => {
            const text = clip(`${row === selected ? "> " : "  "}${safe(row.label)}${compact ? ` (${start + i + 1}/${actions.length})` : ""}`);
            return row === selected ? focus(text) : text;
          });
        }
        output.push(...body);
        if (descriptionBudget) output.push(...wrapped(safe(description)).slice(0, descriptionBudget).map(muted));
        output.push(...footer);
        if (saveBudget) output.push(muted(clip(`Ctrl-S Apply (${count()}) | F4 changes`)));
        const compactHint = current.kind === "main"
          ? current.search.value ? "Enter | Esc clear" : dirty() ? "Ctrl-S | Esc review" : "Enter | Esc close"
          : current.kind === "list" && current.picker ? "Enter | Esc cancel" : "Enter | Esc back";
        output.push(...(compact ? [clip(w <= 20 ? compactHint.replaceAll(" | ", "|").replace("Ctrl-S", "^S") : compactHint)] : wrapped(hint).slice(0, hintBudget)).map(muted));
      } else if (current.kind === "input") {
        output.push(muted(clip("Enter continue | Esc cancel")));
      } else {
        let content: readonly string[];
        if (current.kind === "compare") {
          const names = compareNames();
          output.push(clip(`View: ${names[current.index]} (${current.index + 1}/${names.length})`));
          content = comparison(current); hint = "Left/Right view | Enter views | PgUp/PgDn | Esc back";
        } else if (current.kind === "details") content = current.content();
        else {
          const keys = [...changedKeys()];
          const key = keys[Math.min(current.index, keys.length - 1)];
          const affected = (controller.editor?.changes ?? []).filter((item) => changeKey(item.path) === key);
          const route = routes().find((item) => `${item.kind}:${item.id}` === key);
          const task = tasks().find((item) => `memory.${item.id}` === key);
          output.push(clip(`${current.index < keys.length ? current.index + 1 : 0}/${keys.length} changes`));
          content = [`Target: ${controller.editor?.path ?? controller.view?.files.native ?? ""}`,
            ...(key ? [`${key}`, ...affected.flatMap((item) => [`Saved: ${item.beforeKind === "unset" ? "Inherit" : compactDeclaration(item.before)}`,
              `Proposed: ${item.afterKind === "removed" ? "Inherit (remove user declaration)" : compactDeclaration(item.after)}`])] : ["No changes"]),
            ...(route ? [`Effective: ${route.status}`, ...route.effective.map((candidate, i) => `${i + 1}. ${candidate.model}`)] : []),
            ...(task ? [`Effective: ${task.enabled}; ${task.stateSource}`, `Strategy: ${task.modelStrategy}; ${task.category ?? task.model ?? ""}`,
              ...(task.bindingSource ? [`Binding source: ${task.bindingSource}`] : [])] : []),
            ...(key === "model_profile" ? [`Effective: ${JSON.stringify(controller.editor?.modelProfile ?? {})}`] : []),
          ];
          footer = [clip(`${current.index === keys.length ? "> " : "  "}Apply (${count()})`), clip(`${current.index === keys.length + 1 ? "> " : "  "}Back to main`)];
          hint = "Up/Down change/action | Ctrl-S Apply | PgUp/PgDn | Esc back";
        }
        const lines = content.flatMap((text) => wrapped(safe(text)));
        const reserve = footer.length + (status ? 1 : 0) + 1;
        const bodyHeight = Math.max(1, Math.min(10, height - output.length - reserve));
        pageSize = bodyHeight;
        current.scroll = Math.max(0, Math.min(current.scroll, Math.max(0, lines.length - bodyHeight)));
        output.push(...lines.slice(current.scroll, current.scroll + bodyHeight), ...footer, muted(clip(compact ? "PgUp/PgDn | Esc" : hint)));
      }
      if (status && output.length < height) output.push((failure ? environment.theme?.error : environment.theme?.muted)?.(clip(safe(status))) ?? clip(safe(status)));
      const content = output.slice(0, height);
      if (compact) {
        const boundary = (line: string): string => {
          if (w < 3) return focus("-".repeat(w));
          const label = clip(line, w - 2);
          return `${focus("-")}${label}${focus("-".repeat(Math.max(1, w - 1 - visibleWidth(label))))}`;
        };
        return content.map((line, index) => index === 0 || index === content.length - 1 ? boundary(line) : line);
      }
      const rule = focus("-".repeat(w));
      const framed = [rule, ...content, rule];
      return framed.length + 2 <= totalHeight ? ["", ...framed, ""] : framed;
    },
  };
  return component;
}
