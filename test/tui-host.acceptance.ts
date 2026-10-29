import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import type { Socket } from "node:net";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripTerminalSequences } from "@earendil-works/pi-tui";
import { object } from "../src/native/config.js";
import { nodeValue, readDocument } from "../src/config.js";
import { integrationLauncher } from "./integration-env.js";

test("real installed TUI edits, cancels, applies, reloads and undoes without inference", { timeout: 180000 }, async (t) => {
  // Given: the production extension with a synthetic provider in an isolated HOME.
  const home = await realpath(await mkdtemp(join(tmpdir(), "route-tui-home-")));
  const agentDir = join(home, ".omo", "agent");
  const project = join(home, "project");
  const packageDir = join(home, "extension");
  const compiled = dirname(fileURLToPath(import.meta.url));
  await mkdir(agentDir, { recursive: true });
  await mkdir(join(project, ".omo"), { recursive: true });
  await mkdir(packageDir);
  await writeFile(join(packageDir, "package.json"), JSON.stringify({ name: "synthetic-tui-acceptance", type: "module", pi: { extensions: ["./index.js"] } }));
  await writeFile(join(packageDir, "index.js"), `export { extension as default } from ${JSON.stringify(pathToFileURL(join(compiled, "tui-host-fixture.js")).href)};\n`);
  const path = join(agentDir, "settings.json");
  const settings = { defaultProvider: "fixture", defaultModel: "one", checkForUpdates: false,
    theme: process.env["TUI_THEME"] ?? "dark",
    disabledBuiltinExtensions: ["codemode", "hooks"], promptCache: { keepAlive: { enabled: false } },
    configReload: { enabled: true }, packages: [], extensions: [] };
  const original = `{\n// preserved comment\n${JSON.stringify(settings).slice(1, -1)}\n}\n`;
  await writeFile(path, original, { mode: 0o600 });
  await writeFile(join(home, ".omo", "omo.jsonc"), "// preserved native comment\n" + JSON.stringify({
    memory: { enabled: false }, categories: { quick: { models: ["fixture/one"] } },
    profiles: { focus: { model_profiles: { custom: { models: ["fixture/one"] } } } },
  }), { mode: 0o600 });
  await writeFile(join(project, ".omo", "omo.jsonc"), JSON.stringify({ categories: { quick: { models: ["fixture/fixture/nested"] } } }), { mode: 0o600 });
  const sockets = new Set<Socket>();
  const history: Record<string, unknown>[] = [];
  let latestFrame: Record<string, unknown> = {};
  const waiters = new Set<{ readonly predicate: (event: Record<string, unknown>) => boolean; readonly resolve: (event: Record<string, unknown>) => void }>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    createInterface({ input: socket }).on("line", (line) => {
      const event: unknown = JSON.parse(line);
      assert.ok(object(event));
      history.push(event);
      if (event["type"] === "frame" || event["type"] === "open") latestFrame = event;
      for (const waiter of [...waiters]) if (waiter.predicate(event)) { waiters.delete(waiter); waiter.resolve(event); }
    });
  });
  const eventPath = join(home, "events.sock");
  server.listen(eventPath);
  await once(server, "listening");
  const next = (predicate: (event: Record<string, unknown>) => boolean) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => { waiters.delete(waiter); reject(new Error(`Missing TUI event. Recent events: ${JSON.stringify(history.slice(-5))}`)); }, 30000);
    const waiter = { predicate, resolve: (event: Record<string, unknown>) => { clearTimeout(timeout); resolve(event); } };
    waiters.add(waiter);
  });
  const ready = next((event) => event["type"] === "ready");
  const watched = next((event) => event["type"] === "watch-ready");
  const host = spawn(process.env["OMO_SPIKE_BUN_PATH"] ?? "bun", [join(compiled, "extension-pty-fixture.js"), integrationLauncher(), "--no-session", "--no-extensions", "--no-skills", "-e", packageDir], {
    cwd: project,
    env: { HOME: home, PATH: process.env["PATH"] ?? "/usr/bin:/bin", TERM: "xterm-256color", LANG: "en_US.UTF-8",
      OMO_CODING_AGENT_DIR: agentDir, SENPI_CODING_AGENT_DIR: agentDir, PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: "1", SENPI_OFFLINE: "1", TUI_EVENTS: eventPath, OMO_ROUTE_PANEL_NODE_PATH: process.execPath, OMO_PROFILE: "focus",
      TUI_COLS: process.env["TUI_COLS"] ?? "120", TUI_ROWS: process.env["TUI_ROWS"] ?? "40",
      OMO_ROUTE_PANEL_TEST_ENTRY: process.env["OMO_ROUTE_PANEL_TEST_ENTRY"] ?? "",
      TUI_CONTEXT_CAPTURE: process.env["TUI_CONTEXT_CAPTURE"] ?? "" },
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });
  if (!host.stdin || !host.stdout || !host.stderr) throw new Error("Missing isolated host pipes.");
  const stdin = host.stdin;
  const stdout = host.stdout;
  const stderr = host.stderr;
  let terminal = "";
  let hostMain: string | undefined;
  const captures = new Map<string, Record<string, unknown>>();
  const capture = (name: string, event: Record<string, unknown>): void => {
    captures.set(name, { ...event, cols: Number(process.env["TUI_COLS"] ?? 120), rows: Number(process.env["TUI_ROWS"] ?? 40) });
  };
  stdout.on("data", (chunk: Buffer) => { terminal = (terminal + chunk.toString()).slice(-200000); });
  stderr.on("data", (chunk: Buffer) => { terminal = (terminal + chunk.toString()).slice(-200000); });
  const exited = once(host, "exit");
  let pid: number | undefined;
  host.on("message", (message: unknown) => { if (object(message) && message["type"] === "host-pid" && typeof message["pid"] === "number") pid = message["pid"]; });
  t.after(async () => {
    if (host.exitCode === null && host.signalCode === null) { if (pid) process.kill(pid, "SIGKILL"); host.kill("SIGKILL"); await exited; }
    for (const waiter of waiters) waiter.resolve({ type: "cleanup" });
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const evidence = process.env["OMO_TUI_EVIDENCE_DIR"];
    if (evidence) {
      await mkdir(evidence, { recursive: true });
      await writeFile(join(evidence, "terminal.ansi"), terminal);
      if (hostMain !== undefined) await writeFile(join(evidence, "host-main.ansi"), hostMain);
      await writeFile(join(evidence, "events.json"), JSON.stringify(history, null, 2));
      for (const [name, event] of captures) await writeFile(join(evidence, `capture-${name}.json`), JSON.stringify(event, null, 2));
    }
    await rm(home, { recursive: true, force: true });
  });
  try { await Promise.all([ready, watched]); } catch (error) { throw new Error(`TUI startup failed: ${terminal.slice(-6000)}`, { cause: error }); }
  const frameText = (event: Record<string, unknown>): string => Array.isArray(event["lines"]) ? event["lines"].join("\n") : "";
  let lastInput = 0;
  async function send(data: string, predicate: (event: Record<string, unknown>) => boolean) {
    const expectedInput = lastInput + 1;
    const event = next((item) => predicate(item) && (item["inputId"] === undefined || item["type"] === "open" || item["inputId"] === expectedInput));
    stdin.write(data);
    const found = await event;
    if (typeof found["inputId"] === "number") lastInput = found["inputId"];
    return found;
  }
  async function input(key: string): Promise<Record<string, unknown>> {
    if (key.length > 1 && !key.includes("\u001b")) {
      let event: Record<string, unknown> = {};
      for (const char of key) event = await input(char);
      return event;
    }
    return send(key, (event) => event["type"] === "input" && event["key"] === key);
  }
  const open = () => send("/route-panel\r", (event) => event["type"] === "open" || event["type"] === "notice");
  const cleanText = (event: Record<string, unknown>): string => stripTerminalSequences(frameText(event));
  const settled = (event: Record<string, unknown>) => event["type"] === "frame" && !/Working|Applying\.\.\.|Validating\.\.\./.test(cleanText(event));
  const key = (data: string) => send(data, settled);
  async function control(value: string): Promise<void> {
    const armed = next((event) => event["type"] === "armed" && event["control"] === value);
    for (const socket of sockets) socket.write(`${value}\n`);
    await armed;
  }
  async function select(label: string): Promise<void> {
    // Subscribe to each actual key event; navigation is not time-based polling.
    const prefix = label.slice(0, Math.min(10, Number(process.env["TUI_COLS"] ?? 120) - 5));
    let direction = "\u001b[B";
    for (let count = 0; count < 100; count++) {
      const selected = cleanText(latestFrame).split("\n").some((line) => {
        const marked = line.trimStart();
        if (marked.startsWith(`> ${prefix}`)) return true;
        if (!marked.startsWith("> ") || !marked.includes("...")) return false;
        const visibleLabel = marked.slice(2, marked.indexOf("...")).trimEnd();
        return visibleLabel.length > 0 && label.startsWith(visibleLabel);
      });
      if (selected) return;
      const before = cleanText(latestFrame);
      await key(direction);
      if (cleanText(latestFrame) === before) direction = "\u001b[A";
    }
    assert.fail(`Could not select ${label}:\n${cleanText(latestFrame)}`);
  }
  async function choose(label: string): Promise<Record<string, unknown>> {
    await select(label);
    return key("\r");
  }
  async function search(value: string): Promise<void> {
    await key("\u0015");
    if (value) await input(value);
  }
  async function editQuick(model: string): Promise<void> {
    await search("quick");
    capture("route-search", latestFrame);
    capture("chain", await key("\r"));
    capture("candidate-actions", await key("\r"));
    capture("model-picker", await choose("Replace model"));
    capture("raw-model-id-paste", await key("\u001b[200~fixture/fixture/nested\u001b[201~"));
    await key("\u0015");
    await input(model);
    capture("model-search", latestFrame);
    await key("\r");
    capture("local-apply-blocked", await key("\u0013"));
    await key("\r");
    capture("reasoning-choices", await choose("Reasoning"));
    capture("chain-reasoning", await choose("high"));
    capture("chain-local", latestFrame);
    capture("accepted-route", await choose("Use chain"));
  }
  async function editProfile(): Promise<void> {
    await search("Model profile");
    capture("profile-picker", await key("\r"));
    await input("custom");
    capture("profile-chosen", await key("\r"));
    await key("\u001b");
  }
  async function editRecall(): Promise<void> {
    await search("");
    await key("\t");
    await search("recall");
    capture("recall-edit", await key("\r"));
    capture("recall-toggled", await key(" "));
    capture("recall-explicit-choices", await key("\r"));
    await choose("Enabled");
    capture("recall-category-choices", await choose("Category"));
    await input("quick");
    capture("recall-category-accepted", await key("\r"));
    await choose("Back to main");
    await key("\t");
  }
  async function createCategory(id: string, model: string): Promise<void> {
    await search("");
    capture("new-category-input", await choose("Add category"));
    await input(id);
    capture("new-category-picker", await key("\r"));
    await input(model);
    capture("new-category-accepted", await key("\r"));
  }
  async function editCustomCategories(): Promise<void> {
    await createCategory("custom-one", "fixture/fixture/nested");
    await createCategory("custom-two", "one");
    await search("no-match");
    await choose("Add category");
    await input("custom-one");
    capture("duplicate-category", await key("\r"));
    capture("duplicate-located", await choose("Locate category"));
    await key("\r");
    capture("add-candidate-picker", await choose("Add candidate"));
    await input("two");
    capture("added-candidate", await key("\r"));
    await key("\r");
    capture("reordered-candidates", await choose("Move earlier"));
    await key("\r");
    await choose("Reasoning");
    await choose("high");
    capture("custom-chain-accepted", await choose("Use chain"));
    await key("\r");
    capture("proposed-comparison", await choose("Compare recommendation"));
    capture("saved-effective-comparison", await key("\u001b[C"));
    capture("saved-override-comparison", await key("\u001b[C"));
    capture("upstream-comparison", await key("\u001b[C"));
    capture("compare-view-choices", await key("\r"));
    await key("\u001b");
    await key("\u001b");
    await key("\u001b");
  }
  const nativePath = join(home, ".omo", "omo.jsonc");
  const nativeOriginal = await readFile(nativePath, "utf8");
  const assertUnwritten = async () => {
    assert.equal(await readFile(nativePath, "utf8"), nativeOriginal);
    assert.equal(await readFile(path, "utf8"), original);
  };

  t.diagnostic("Compact main search, section navigation and immediate-parent cancellation");
  {
    const painted = process.env["TUI_CONTEXT_CAPTURE"] === "1" ? new Promise<void>((resolve, reject) => {
      const onData = (): void => {
        if (!stripTerminalSequences(terminal).includes("Esc close")) return;
        clearTimeout(timeout); stdout.off("data", onData); resolve();
      };
      const timeout = setTimeout(() => { stdout.off("data", onData); reject(new Error("Missing actual host main-view paint.")); }, 30000);
      stdout.on("data", onData);
    }) : undefined;
    capture("main", await open());
    if (painted) { await painted; hostMain = terminal; }
    assert.doesNotMatch(cleanText(latestFrame), /Settings|Diagnostics/);
    capture("cjk-paste", await key("\u001b[200~不存在\u001b[201~"));
    await key("\u001b[D");
    await key("\u007f");
    await key("\u001b[H");
    capture("search-cursor-edit", await key("\u001b[3~"));
    capture("empty-search", latestFrame);
    await select("More");
    capture("empty-search-action", latestFrame);
    capture("search-cleared", await key("\u001b"));
    assert.doesNotMatch(cleanText(latestFrame), /不存在/);
    capture("background", await key("\t"));
    capture("recall-fields", await key("\r"));
    capture("switch-choices", await key("\r"));
    await key("\u001b");
    await key("\u001b");
    await search("nudge");
    capture("nudge-read-only", await key("\r"));
    capture("local-processing-details", await choose("Local processing"));
    await key("\u001b");
    await key("\u001b");
    await search("sync");
    capture("sync-read-only", await key("\r"));
    await key("\u001b");
    await key("\t");
    capture("more", await choose("More"));
    capture("scope-choices", await choose("Change scope"));
    capture("project-scope", await choose("Current project"));
    await choose("More");
    await choose("Change scope");
    await choose("User");
    capture("new-category-name", await choose("Add category"));
    await input("bad name");
    capture("rejected-name", await key("\r"));
    await key("\u001b");
    await search("quick");
    capture("unchanged-chain", await key("\r"));
    capture("comparison", await choose("Compare recommendation"));
    capture("comparison-next", await key("\u001b[C"));
    await key("\u001b");
    await key("\u001b");
    await assertUnwritten();
    await key("\u001b"); // clear main search before closing
    await send("\u001b", (event) => event["type"] === "closed");
  }
  t.diagnostic("Native multi-item edits remain temporary; dirty Esc preserves or discards explicitly");
  {
    await open();
    await editQuick("two");
    await editProfile();
    await editRecall();
    await editCustomCategories();
    capture("dirty-paste-apply", await key("\u001b[200~apply\u001b[201~"));
    await search("");
    capture("dirty-paste-tab", await key("\u001b[200~tab\u001b[201~"));
    await search("");
    await assertUnwritten();
    await search("");
    capture("changes", await choose("Changes"));
    await key("\u001b");
    capture("discard-choice", await key("\u001b"));
    await key("\u001b");
    capture("discard-canceled", latestFrame);
    await assertUnwritten();
    await key("\u001b");
    await select("Discard & close");
    await send("\r", (event) => event["type"] === "closed");
    await assertUnwritten();
  }
  t.diagnostic("Ordinary host reload cancels accepted native edits");
  {
    await open();
    await editQuick("two");
    const reloaded = next((event) => event["type"] === "ready" && event["reason"] === "reload");
    for (const socket of sockets) socket.write("reload\n");
    await reloaded;
    await assertUnwritten();
  }
  t.diagnostic("Apply saves native route/profile together, not removed Settings; pre-reload notice is observable");
  {
    await open();
    await editQuick("two");
    await editProfile();
    await editRecall();
    await editCustomCategories();
    await search("");
    capture("combined-changes", await choose("Changes"));
    const reloaded = next((event) => event["type"] === "ready" && event["reason"] === "reload");
    const savedNotice = next((event) => event["type"] === "notice" && typeof event["message"] === "string" && event["message"].startsWith("Saved"));
    await input("\u0013");
    await savedNotice;
    await reloaded;
    const saved = await readDocument(nativePath);
    assert.equal(nodeValue(saved, ["[native]", "model_profile"]), "custom");
    const models = nodeValue(saved, ["[native]", "categories", "quick", "models"]);
    assert.deepEqual(models, [{ model: "fixture/two", reasoning: "high" }]);
    assert.equal(nodeValue(saved, ["[native]", "memory", "recall", "enabled"]), true);
    assert.equal(nodeValue(saved, ["[native]", "memory", "recall", "category"]), "quick");
    assert.deepEqual(nodeValue(saved, ["[native]", "categories", "custom-one", "models"]),
      [{ model: "fixture/two", reasoning: "high" }, { model: "fixture/fixture/nested" }]);
    assert.deepEqual(nodeValue(saved, ["[native]", "categories", "custom-two", "models"]), [{ model: "fixture/one" }]);
    assert.match(saved.text, /\/\/ preserved native comment/);
    assert.equal(await readFile(path, "utf8"), original);
  }
  t.diagnostic("Undo after reopening uses Changes and explicit Apply, preserving unrelated Settings");
  {
    await open();
    capture("undo", await choose("Undo last save"));
    const reloaded = next((event) => event["type"] === "ready" && event["reason"] === "reload");
    await input("\u0013");
    await reloaded;
    const saved = await readDocument(nativePath);
    assert.equal(nodeValue(saved, ["[native]"]), undefined);
    assert.deepEqual(nodeValue(saved, ["categories", "quick", "models"]), ["fixture/one"]);
    assert.equal(await readFile(path, "utf8"), original);
  }
  t.diagnostic("Catalog drift refuses Apply, preserves the buffer, and never announces Saved");
  {
    await open();
    await editQuick("two");
    const before = await readFile(nativePath, "utf8");
    await control("drift-catalog");
    const noticeCount = history.filter((event) => event["type"] === "notice").length;
    capture("catalog-conflict", await key("\u0013"));
    assert.equal(await readFile(nativePath, "utf8"), before);
    assert.equal(history.filter((event) => event["type"] === "notice").length, noticeCount);
    await control("restore-catalog");
    await key("\u001b");
    await key("\u001b");
    await select("Discard & close");
    await send("\r", (event) => event["type"] === "closed");
  }
  t.diagnostic("Saved but reload failed clears the buffer and is undoable only after reopening");
  {
    await open();
    await editQuick("two");
    await control("fail-next-reload");
    const failedNotice = next((event) => event["type"] === "notice" && typeof event["message"] === "string" && event["message"].includes("reload failed"));
    capture("saved-reload-failed", await key("\u0013"));
    await failedNotice;
    const saved = await readFile(nativePath, "utf8");
    capture("saved-no-second-apply", await key("\u0013"));
    assert.equal(await readFile(nativePath, "utf8"), saved);
    await key("\u001b");
    await send("\u001b", (event) => event["type"] === "closed");
    await open();
    capture("reload-failure-undo", await choose("Undo last save"));
    const reloaded = next((event) => event["type"] === "ready" && event["reason"] === "reload");
    await input("\u0013");
    await reloaded;
    assert.equal(nodeValue(await readDocument(nativePath), ["[native]"]), undefined);
    assert.equal(await readFile(path, "utf8"), original);
  }
  assert.equal(history.some((event) => event["type"] === "inference-forbidden"), false);
  stdin.write("/rp-quit\r");
  const [code] = await exited;
  assert.equal(code, 0);
});
