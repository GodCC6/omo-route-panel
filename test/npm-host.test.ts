import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { fork } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { futureNpmRuntime } from "./native-fixture.js";

const cases = [
  { name: "opens an unchanged nested npm installation", hoisted: false, change: "none" },
  { name: "opens an unchanged hoisted npm installation", hoisted: true, change: "none" },
  { name: "rejects an npm engine rewritten before extension import (PR #6)", hoisted: false, change: "entry" },
  { name: "rejects a report rewrite even with preserved mtime and version (PR #6)", hoisted: false, change: "report" },
  { name: "rejects a loaded engine module rewrite with an unchanged entry", hoisted: false, change: "module" },
  { name: "rejects a same-version npm package replacement before opening", hoisted: false, change: "package" },
  { name: "rejects a launcher link retargeted to an older on-disk package", hoisted: true, change: "link" },
] as const;

for (const scenario of cases) {
  test(scenario.name, { timeout: 20_000 }, async (t) => {
    const home = await mkdtemp(join(await realpath(tmpdir()), "npm-host-"));
    t.after(() => rm(home, { recursive: true, force: true }));
    const modules = join(home, "node_modules");
    const root = await futureNpmRuntime(modules, "synthetic");
    const engine = join(scenario.hoisted ? modules : join(root, "node_modules"), "@code-yeongyu", "senpi");
    const entry = join(engine, "dist", "cli.js");
    const module = join(engine, "dist", "identity.js");
    const report = join(root, "plugin", "runtime", "category-coverage", "index.js");
    await mkdir(dirname(entry), { recursive: true });
    await mkdir(join(root, "plugin", "extensions"), { recursive: true });
    await mkdir(join(home, ".omo", "agent"), { recursive: true });
    await writeFile(join(engine, "package.json"), JSON.stringify({
      name: "@code-yeongyu/senpi", version: "synthetic", type: "module",
      main: "dist/cli.js", bin: { senpi: "dist/cli.js" },
      exports: { ".": { import: "./dist/cli.js" } },
    }));
    await writeFile(join(root, "plugin", "extensions", "omo.js"), "export const plugin = 'old';\n");
    await writeFile(join(root, "plugin", "package.json"), JSON.stringify({
      type: "module", pi: { extensions: ["./extensions/omo.js"] },
    }));
    await writeFile(module, "export const identity = 'old';\n");
    await writeFile(entry, `
      import { identity } from "./identity.js";
      import { runNpmHost } from ${JSON.stringify(new URL("./npm-host-fixture.js", import.meta.url).href)};
      await runNpmHost(identity);
    `);
    const alias = join(modules, "current");
    if (scenario.change === "link") {
      await cp(root, `${root}.other`, { recursive: true, preserveTimestamps: true });
      await writeFile(join(`${root}.other`, "plugin", "extensions", "omo.js"), "export const plugin = 'new';\n");
      await symlink(root, alias);
    }
    // Filesystem timestamps may have one-second resolution. Start strictly after
    // the fixture's creation second; this is the invariant's boundary, not a race delay.
    const latest = Math.max((await stat(entry)).ctimeMs, (await stat(modules)).ctimeMs);
    await setTimeout(Math.max(0, Math.ceil(latest / 1000) * 1000 - Date.now() + 1));
    const child = fork(entry, [], {
      execPath: process.execPath, cwd: home,
      env: {
        HOME: home, OMO_BIN: join(scenario.change === "link" ? alias : root, "bin", "omo.js"),
        OMO_ROUTE_PANEL_NODE_PATH: process.execPath,
        ...(scenario.change === "link" ? { NPM_HOST_PLUGIN: join(alias, "plugin", "extensions", "omo.js") } : {}),
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    const exited = once(child, "exit");
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exited;
    });
    const ready = await once(child, "message", { signal: t.signal });
    assert.deepEqual(ready[0], { ready: true, loadedIdentity: "old", plugin: "old" });
    switch (scenario.change) {
      case "none": break;
      case "entry":
        await writeFile(entry, "// replacement engine\n");
        await writeFile(join(root, "package.json"), JSON.stringify({
          name: "omo-ai", version: "new", type: "module", bin: { omo: "bin/omo.js" },
        }));
        break;
      case "report": {
        const before = await stat(report);
        await writeFile(report, `${await readFile(report, "utf8")}\n// replacement report\n`);
        await utimes(report, before.atime, before.mtime);
        break;
      }
      case "module": await writeFile(module, "export const identity = 'new';\n"); break;
      case "package":
        await cp(root, `${root}.next`, { recursive: true, preserveTimestamps: true });
        await rename(root, `${root}.old`);
        await rename(`${root}.next`, root);
        break;
      case "link":
        await symlink(`${root}.other`, `${alias}.next`);
        await rename(`${alias}.next`, alias);
        break;
    }
    const result = once(child, "message", { signal: t.signal });
    child.send("open");
    const [message] = await result;
    if (scenario.change === "none") {
      assert.deepEqual(message, { opened: true, notices: [], loadedIdentity: "old" });
    } else {
      assert.ok(typeof message === "object" && message !== null && "opened" in message && "notices" in message);
      assert.equal(message.opened, false);
      assert.match(JSON.stringify(message.notices), /host-installation-changed/);
    }
    const [code] = await exited;
    assert.equal(code, 0);
  });
}
