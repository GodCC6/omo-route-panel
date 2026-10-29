import { homedir } from "node:os";
import { dirname, join, parse, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { catalogSnapshot, sanitizeModels } from "./catalog.js";
import { digest, discover, inside, json, NativeError, object, projectConfig } from "./config.js";
import { runProcess } from "./process.js";
import { createMirrorRoot } from "../scratch.js";
import { resolveAgentDir } from "../metadata.js";
import { installedRuntime, nodeCapabilities } from "../runtime.js";
import type {
  ConfigObject, NativeAdapter, NativeContext, NativeEngine, NativeFailure,
  NativeInspection, NativeOptions, NativeReport, NativeResult, NativeRung,
  NativeRoute, NativeView,
} from "./types.js";
export type * from "./types.js";
export { catalogSnapshot } from "./catalog.js";
export { discover, projectConfig } from "./config.js";

export const NATIVE_REASONING = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"] as const;
export const NATIVE_MODEL_PROFILES = ["daily-normal", "daily-heavy", "geeky-normal", "geeky-heavy"] as const;
const REPORT_PATH = "plugin/runtime/category-coverage/index.js";
const worker = fileURLToPath(new URL("./worker.js", import.meta.url));

/** Static installation inspection: never imports the report or reads configuration. */
export async function nativeInstallation(options: NativeOptions = {}) {
  const installed = await installedRuntime({
    ...(options.launcherPath === undefined ? {} : { launcherPath: options.launcherPath }),
    ...(options.runtimeRoot === undefined ? {} : { runtimeRoot: options.runtimeRoot }),
    ...(options.home === undefined ? {} : { home: options.home }),
  });
  const moduleDigest = digest(await readFile(join(installed.runtimeRoot, REPORT_PATH)));
  return { ...installed, moduleDigest };
}

function failure(error: unknown): NativeFailure {
  return { status: "unsupported", code: error instanceof NativeError ? error.code : "native-unavailable" };
}
function strings(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
}
function rung(value: unknown): value is NativeRung {
  return object(value) && json(value) && typeof value["model"] === "string" && typeof value["source"] === "string"
    && typeof value["state"] === "string";
}
function route(value: unknown): value is NativeRoute {
  return object(value) && (value["kind"] === "category" || value["kind"] === "agent")
    && typeof value["name"] === "string"
    && ["resolved", "disabled", "unavailable"].includes(String(value["status"]))
    && strings(value["runtime"]) && Array.isArray(value["rungs"]) && value["rungs"].every(rung)
    && (value["primary"] === undefined || typeof value["primary"] === "string")
    && (value["reason"] === undefined || typeof value["reason"] === "string");
}
function report(value: unknown): NativeReport {
  if (!object(value) || !Array.isArray(value["categories"]) || !value["categories"].every(route)
    || !Array.isArray(value["agents"]) || !value["agents"].every(route)
    || !strings(value["excludeModels"]) || !object(value["modelProfile"]) || !json(value["modelProfile"])
    || (value["configProfile"] !== undefined && typeof value["configProfile"] !== "string")) throw new NativeError("report-shape");
  return {
    categories: value["categories"], agents: value["agents"], excludeModels: value["excludeModels"],
    modelProfile: value["modelProfile"], ...(value["configProfile"] === undefined ? {} : { configProfile: value["configProfile"] }),
  };
}

export function createNativeAdapter(options: NativeOptions = {}): NativeAdapter {
  const nodeInput = options.nodePath ?? process.execPath;
  const homeInput = options.home ?? homedir();
  const launcherInput = options.launcherPath ?? join(homeInput, ".local", "bin", "omo");
  const agentDir = options.agentDir ?? (options.home === undefined ? resolveAgentDir(homeInput, process.env) : join(homeInput, ".omo", "agent"));
  const timeoutMs = options.timeoutMs ?? 15_000;
  async function engine(): Promise<NativeEngine> {
    const installed = await nativeInstallation({ ...options, launcherPath: launcherInput });
    const node = await nodeCapabilities(nodeInput, { timeoutMs, ...(options.signal ? { signal: options.signal } : {}) });
    return { ...installed, ...node };
  }
  async function inspect(context: NativeContext): Promise<NativeResult<NativeInspection>> {
    try {
      const trusted = await engine();
      if (context.profile !== undefined && (!context.profile || context.profile.length > 200)) throw new NativeError("profile-invalid");
      const found = discover(homeInput, context.project);
      return {
        status: "ok",
        value: {
          ...found, engine: trusted, ...(context.profile === undefined ? {} : { profile: context.profile }),
          settings: {
            globalPath: join(agentDir, "settings.json"),
            projectPath: join(found.project, ".omo", "settings.json"),
            projectInfluence: "unknown",
            pathStatus: "verified-global",
          },
        },
      };
    } catch (error) { return failure(error); }
  }
  async function view(
    inspection: NativeInspection, home: string, project: string,
    models: readonly { readonly provider: string; readonly id: string }[], profile: string | undefined,
    readPaths: readonly string[],
  ): Promise<NativeView> {
    const nativeEnv = { HOME: home, ...(profile === undefined ? {} : { OMO_PROFILE: profile }) };
    const env = { ...nativeEnv };
    async function operation(name: "modelChains" | "configDoctorLines"): Promise<unknown> {
      const raw = await runProcess({
        executable: inspection.engine.nodePath,
        args: [
          "--permission", "--no-addons", "--no-warnings",
          ...[inspection.engine.runtimeRoot, dirname(worker), ...readPaths].map((path) => `--allow-fs-read=${path}`),
          worker,
        ],
        cwd: project, env,
        input: JSON.stringify({
          module: join(inspection.engine.runtimeRoot, REPORT_PATH),
          digest: inspection.engine.moduleDigest, operation: name, request: { cwd: project, env: nativeEnv, models },
        }),
        timeoutMs,
        ...(options.signal ? { signal: options.signal } : {}),
      });
      return JSON.parse(raw);
    }
    // Each operation gets its own fresh process, with no write/network/subprocess grants.
    const rawReport = await operation("modelChains");
    const doctor = await operation("configDoctorLines");
    if (!strings(doctor)) throw new NativeError("doctor-shape");
    return { report: report(rawReport), doctorLines: doctor };
  }
  return {
    inspect,
    async catalog() {
      try {
        if (!options.host) throw new NativeError("host-required");
        if (options.signal?.aborted) throw new NativeError("process-aborted");
        const catalog = await options.host.catalog();
        if (options.signal?.aborted) throw new NativeError("process-aborted");
        return catalog;
      } catch (error) { return failure(error); }
    },
    async resolve(input) {
      if (!options.host) return { status: "unsupported", code: "host-required" };
      const host = options.host;
      if (input.catalog.status !== "ok") return { status: "unknown", code: "catalog-unknown" };
      const checked = await inspect(input);
      if (checked.status !== "ok") return checked;
      const inspection = checked.value;
      let temp: string | undefined;
      try {
        const suppliedCatalog = input.catalog;
        async function verifyBinding(): Promise<void> {
          if (options.signal?.aborted) throw new NativeError("process-aborted");
          await host.verify(inspection.engine);
          const current = await host.catalog();
          if (current.status !== "ok" || current.revision !== suppliedCatalog.revision) throw new NativeError("host-catalog-changed");
          if (options.signal?.aborted) throw new NativeError("process-aborted");
        }
        await verifyBinding();
        const safeModels = sanitizeModels(input.catalog.models);
        const checkedCatalog = catalogSnapshot(safeModels, input.catalog.capturedAt);
        if (checkedCatalog.status !== "ok" || checkedCatalog.revision !== input.catalog.revision) throw new NativeError("catalog-revision");
        temp = await createMirrorRoot();
        const outsideHome = !inside(inspection.home, inspection.project);
        // An outside-HOME ancestry is projected beneath a synthetic branch.
        // This preserves layer order without letting a mirror climb into real
        // scratch-directory ancestors. Real/mirror reports must still agree.
        const projectRelative = outsideHome
          ? join("project-context", relative(parse(inspection.project).root, inspection.project))
          : relative(inspection.home, inspection.project);
        const mirrorRoot = join(temp, "effective");
        const defaultRoot = join(temp, "defaults");
        const mirrorHome = mirrorRoot;
        const defaultHome = defaultRoot;
        const mirrorProject = join(mirrorRoot, projectRelative);
        const defaultProject = join(defaultRoot, projectRelative);
        await mkdir(mirrorHome, { recursive: true, mode: 0o700 });
        await mkdir(defaultHome, { recursive: true, mode: 0o700 });
        await mkdir(mirrorProject, { recursive: true, mode: 0o700 });
        await mkdir(defaultProject, { recursive: true, mode: 0o700 });
        const configs = new Map<string, ConfigObject>();
        for (const file of inspection.files) configs.set(file.sourceId, file.config);
        async function populate(home: string, replacements: Readonly<Record<string, ConfigObject>> = {}): Promise<void> {
          for (const key of Object.keys(replacements)) if (!configs.has(key)) throw new NativeError("candidate-source");
          for (const file of inspection.files) {
            const replacement = replacements[file.sourceId];
            const config = replacement === undefined ? file.config : projectConfig(replacement);
            if (replacement !== undefined && !isDeepStrictEqual(config, replacement)) throw new NativeError("candidate-fields");
            const target = outsideHome && file.scope === "project"
              ? join(home, "project-context", relative(parse(file.path).root, file.path))
              : join(home, file.relativePath);
            if (!inside(home, target)) throw new NativeError("mirror-path");
            await mkdir(dirname(target), { recursive: true, mode: 0o700 });
            await writeFile(target, JSON.stringify(config), { mode: 0o600, flag: "wx" });
          }
        }
        await populate(mirrorHome);
        // Missing directories are treated as literal paths by Node permission
        // grants, so also grant the two exact potential filenames explicitly.
        const realReadPaths = inspection.watchPaths.flatMap((path) => [path, join(path, "omo.jsonc"), join(path, "omo.json")]);
        const real = await view(inspection, inspection.home, inspection.project, safeModels, input.profile, realReadPaths);
        const effective = await view(inspection, mirrorHome, mirrorProject, safeModels, input.profile, [mirrorRoot]);
        // Compare reports, not paths embedded in diagnostic text. A warning on
        // either side means the projection is not a faithful validated context.
        if (!isDeepStrictEqual(real.report, effective.report)) throw new NativeError("mirror-mismatch");
        if (real.doctorLines.length || effective.doctorLines.length) throw new NativeError("config-diagnostics");
        const defaults = await view(inspection, defaultHome, defaultProject, safeModels, undefined, [defaultRoot]);
        let candidate: NativeView | undefined;
        if (input.candidate !== undefined) {
          const candidateRoot = join(temp, "candidate");
          const candidateHome = candidateRoot;
          const candidateProject = join(candidateRoot, projectRelative);
          await mkdir(candidateHome, { recursive: true, mode: 0o700 });
          await mkdir(candidateProject, { recursive: true, mode: 0o700 });
          await populate(candidateHome, input.candidate);
          candidate = await view(inspection, candidateHome, candidateProject, safeModels, input.profile, [candidateRoot]);
          if (candidate.doctorLines.length) throw new NativeError("candidate-diagnostics");
        }
        const after = await inspect(input);
        if (after.status !== "ok" || !isDeepStrictEqual(after.value, inspection)) throw new NativeError("context-changed");
        await verifyBinding();
        return {
          status: "ok",
          value: {
            inspection, catalogRevision: input.catalog.revision, equivalence: "equal", effective, defaults,
            ...(candidate === undefined ? {} : { candidate }),
          },
        };
      } catch (error) { return failure(error); }
      finally { if (temp !== undefined) await rm(temp, { recursive: true, force: true }); }
    },
  };
}
