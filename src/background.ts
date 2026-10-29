import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { BackgroundEvidence, BackgroundRouteEvidence, BackgroundRule } from "./background-evidence.js";
import type { NativeInspection, NativeReport } from "./native/index.js";
import type { BackgroundRoute, Candidate, Json } from "./types.js";

function record(value: Json | undefined): Readonly<Record<string, Json>> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
}
function merge(base: Readonly<Record<string, Json>>, layer: Readonly<Record<string, Json>>): Readonly<Record<string, Json>> {
  const result = { ...base };
  for (const [key, value] of Object.entries(layer)) {
    result[key] = value !== null && typeof value === "object" && !Array.isArray(value)
      ? merge(record(base[key]), record(value)) : value;
  }
  return result;
}

/** Configuration leaves only. Model chains always come from the native report. */
export function backgroundRoutes(
  inspection: NativeInspection | null,
  report: NativeReport | null,
  fields: Readonly<Record<string, Json>>,
  evidence?: BackgroundEvidence,
  scope: "user" | "project" = "project",
): readonly (BackgroundRoute & { readonly semanticEvidence?: BackgroundRouteEvidence })[] {
  let merged: Readonly<Record<string, Json>> = {};
  for (const file of inspection?.files ?? []) merged = merge(merged, file.config);
  const profile = record(record(merged["profiles"])[inspection?.profile ?? ""]);
  let resolved: Readonly<Record<string, Json>> = {};
  for (const layer of [merged, record(merged["[senpi]"]), record(merged["[native]"]), profile, record(profile["[senpi]"]), record(profile["[native]"])]) {
    resolved = merge(resolved, layer);
  }
  const memory = record(resolved["memory"]);
  const agent = typeof memory["agent"] === "string" ? memory["agent"].trim() : "auto";
  const automatic = agent === "" || agent === "auto";
  const identityInput = automatic ? inspection?.project : agent;
  const slugInput = automatic ? basename(identityInput ?? "") : agent;
  const normalized = slugInput.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slug = Array.from(normalized.replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").normalize("NFC").replace(/^-+|-+$/g, "")).slice(0, 40).join("").replace(/-+$/g, "") || "agent";
  const legacySlug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "") || "agent";
  const hash = createHash("sha256").update(identityInput ?? "").digest("hex").slice(0, 8);
  let identity = `${slug}-${hash}`;
  if (inspection && !existsSync(join(inspection.home, ".omo", "memory", "agents", identity))
    && existsSync(join(inspection.home, ".omo", "memory", "agents", `${legacySlug}-${hash}`))) identity = `${legacySlug}-${hash}`;
  const identityKnown = inspection !== null && (scope === "project" || !automatic) && (!automatic || memory["auto_identity"] !== "git");
  const agents = record(memory["agents"]);
  const override = identityKnown ? record(agents[identity]) : {};
  // User scope intentionally excludes project-derived identity overrides.
  const uncertainIdentity = scope === "project" && !identityKnown && Object.keys(agents).length > 0;
  const effective = merge(memory, override);
  const validated = inspection !== null;
  const known = validated && !uncertainIdentity;
  // The native binding checks the global gate before resolving an identity.
  const master = memory["enabled"] !== false;
  const scopeLabel = scope === "user" && automatic ? "User scope; project identity overrides excluded"
    : identityKnown ? `New-task identity: ${identity}` : "New task; git identity is unverified";
  const enabled = (name: string): boolean | null => {
    if (validated && !master) return false;
    // The native sync runner consumes global settings, not identity overrides.
    if (name === "sync") return validated ? record(memory["sync"])["enabled"] !== false : null;
    return known ? record(effective[name])["enabled"] !== false : null;
  };
  const source = (name: string): string => {
    if (validated && !master) return "The global memory configuration gate is disabled.";
    if (name === "sync" && validated) return `${record(memory["sync"])["enabled"] !== undefined ? "Merged global configuration" : "OMO built-in default (enabled)"}; Sync does not use identity overrides.`;
    if (!known) return "Configuration or identity is unverified; the effective switch is unknown.";
    const own = record(override[name])["enabled"];
    const configured = record(memory[name])["enabled"];
    return `${own !== undefined ? "Identity override" : configured !== undefined ? "Merged configuration" : "OMO built-in default (enabled)"}; ${scopeLabel}. Configuration does not prove that a task is running.`;
  };
  const bindingSource = (name: string, field: string): string => {
    if (!known) return "Configuration or identity is unverified.";
    if (record(override[name])[field] !== undefined) return `Identity override; ${scopeLabel}.`;
    const configured = record(memory[name])[field];
    if (configured === undefined) return `OMO built-in default; ${scopeLabel}.`;
    const prefixes = [[], ["[senpi]"], ["[native]"],
      ...(inspection?.profile ? [["profiles", inspection.profile], ["profiles", inspection.profile, "[senpi]"], ["profiles", inspection.profile, "[native]"]] : [])];
    for (const prefix of prefixes.reverse()) {
      for (const file of [...inspection?.files ?? []].reverse()) {
        let value: Json | undefined = file.config;
        for (const part of [...prefix, "memory", name, field]) value = record(value)[part];
        if (value === configured) return `${file.scope === "user" ? "User override" : "Project override"}${prefix[0] === "profiles" ? " in active profile" : ""}; ${scopeLabel}.`;
      }
    }
    return `Merged configuration; ${scopeLabel}.`;
  };
  const category = (name: string): string => {
    const value = record(effective[name])["category"];
    return typeof value === "string" ? value : "quick";
  };
  const candidates = (name: string | null): readonly Candidate[] => known && report !== null && name !== null
    ? report?.categories.find((route) => route.name === name)?.runtime.map((model) => ({ model })) ?? [] : [];
  const recall = category("recall");
  const reflection = category("reflection");
  const factsModel = record(effective["facts"])["model"];
  const quick = record(record(resolved["categories"])["quick"]);
  const userQuick = quick["model"] !== undefined || (Array.isArray(quick["models"]) && quick["models"].length > 0);
  const factsCategory = typeof factsModel !== "string" && (userQuick || quick["disable"] === true) ? "quick" : null;
  const selectedQuick = new Set([
    ...(typeof quick["model"] === "string" ? [quick["model"]] : []),
    ...(Array.isArray(quick["models"]) ? quick["models"] : []),
    ...(Array.isArray(quick["fallback_models"]) ? quick["fallback_models"] : quick["fallback_models"] === undefined ? [] : [quick["fallback_models"]]),
  ].flatMap((value) => {
    const model = typeof value === "string" ? value : record(value)["model"];
    return typeof model === "string" ? [model] : [];
  }));
  const factsCandidates = typeof factsModel === "string" ? [] : quick["disable"] === true ? [] : candidates(factsCategory).filter((entry) => selectedQuick.has(entry.model));
  const dream = record(effective["dream"]);
  const compaction = fields["settings:compaction.model"];
  const rows: readonly BackgroundRoute[] = [
    { id: "recall", title: "Recall / Kibitzer", enabled: enabled("recall"), category: known ? recall : null, model: null, stateSource: source("recall"), modelStrategy: known ? "category" : "unknown", candidates: candidates(recall), policy: "Category candidates are from the native report, not proof of a successful call." },
    { id: "reflection", title: "Reflection", enabled: enabled("reflection"), category: known ? reflection : null, model: null, stateSource: source("reflection"), modelStrategy: known ? "dynamic" : "unknown", candidates: candidates(reflection), policy: "Category candidates and the parent-session fork are selected dynamically using context window, cache and estimated cost; no fixed final model is known." },
    { id: "dream", title: "Dream", enabled: enabled("dream"), category: known ? reflection : null, model: null, stateSource: source("dream"), modelStrategy: known ? "dynamic" : "unknown", candidates: candidates(reflection), policy: `Shares the Reflection category and dynamic parent-session fork selection. Idle threshold: ${String(dream["idle_minutes"] ?? 30)} minutes; minimum interval: ${String(dream["min_hours_between"] ?? 24)} hours; shutdown trigger: ${dream["shutdown_launch"] === false ? "disabled" : "enabled"}. These are configuration values, not running-session state.` },
    { id: "facts", title: "Facts", enabled: enabled("facts"), category: known ? factsCategory : null, model: known && typeof factsModel === "string" ? factsModel : null, stateSource: source("facts"), modelStrategy: !known ? "unknown" : typeof factsModel === "string" ? "fixed" : factsCategory ? "category" : "session", candidates: known ? factsCandidates : [], policy: "Identity facts.model takes precedence over global facts.model, then the user-configured quick chain, otherwise the session model. A disabled quick category skips extraction unless an explicit Facts model is set. Built-in fallbacks are excluded; catalog and exclusion checks still apply. An explicit model is configuration, not a resolved candidate chain." },
    { id: "compaction", title: "Compaction", enabled: null, category: null, model: typeof compaction === "string" ? compaction : null, stateSource: "Global settings value only; project settings trust and loading effects are unknown.", modelStrategy: typeof compaction === "string" ? "fixed" : "unknown", candidates: [], policy: "Shows the configured compaction model, not an active-session model. Unconfigured runtime selection is not verified by memory semantic evidence." },
    ...(["nudge", "sync"] as const).map((id): BackgroundRoute => ({ id, title: id === "nudge" ? "Nudge" : "Memory Sync", enabled: enabled(id), category: null, model: null, stateSource: source(id), modelStrategy: "local", candidates: [], policy: "Local processing; no independent model candidate chain." })),
    { id: "local", title: "Lexical search / projection", enabled: null, category: null, model: null, stateSource: "Local processing; no unified background switch is shown.", modelStrategy: "local", candidates: [], policy: "Local retrieval and file projection; no independent model candidate chain." },
    { id: "completion", title: "completion(default / smol / slow)", enabled: null, category: null, model: null, stateSource: "Explicit helper call, not an automatic background task.", modelStrategy: "helper", candidates: [], policy: "No active context is inspected; no fixed helper model is asserted." },
  ];
  const bound = inspection !== null && evidence?.runtimeRoot === resolve(inspection.engine.runtimeRoot);
  const proof = (rules: readonly BackgroundRule[]): BackgroundRouteEvidence => {
    const reasons = rules.flatMap((rule) => !bound ? ["Background source evidence is not bound to this installation."]
      : evidence?.rules[rule].status === "verified" ? [] : [evidence?.rules[rule].reason || `Missing background semantic evidence: ${rule}.`]);
    return { state: reasons.length ? "unknown" : "verified", rules: [...new Set(rules)], reasons: [...new Set(reasons)] };
  };
  return rows.map((row) => {
    if (!["recall", "reflection", "dream", "facts", "nudge", "sync"].includes(row.id)) return row;
    const identityRules: readonly BackgroundRule[] = row.id !== "sync" && Object.keys(agents).length > 0
      ? ["identityDerivation", "identityOverrides"] : [];
    const stateRules: BackgroundRule[] = ["globalGate"];
    // A proved global false gate decides all task switches before identity lookup.
    if (master) {
      stateRules.push(...identityRules);
      if (row.id === "sync") stateRules.push("syncGlobal");
      if (memory["enabled"] === undefined || record(row.id === "sync" ? memory["sync"] : effective[row.id])["enabled"] === undefined) stateRules.push("defaults");
    }
    const state = proof(stateRules);
    let modelRules: readonly BackgroundRule[] = [];
    if (row.id === "facts") modelRules = [...identityRules, "factsModel", ...(typeof factsModel === "string" ? [] : ["factsQuick"] as const)];
    if (row.id === "recall" || row.id === "reflection" || row.id === "dream") {
      const task = row.id === "dream" ? "reflection" : row.id;
      modelRules = [...identityRules, "identityOverrides", ...(record(effective[task])["category"] === undefined ? ["defaults"] as const : []),
        ...(row.id === "recall" ? [] : ["dreamReflection"] as const)];
    }
    const model = proof(modelRules);
    const strategyRules = [...modelRules, ...(row.id === "reflection" || row.id === "dream" ? ["reflectionDynamic"] as const : [])];
    const strategy = proof(strategyRules);
    const all = proof([...stateRules, ...strategyRules]);
    const reasons = [...new Set([...state.reasons, ...model.reasons, ...strategy.reasons])];
    const semanticEvidence = { ...all, state: reasons.length ? "unknown" as const : "verified" as const, reasons };
    const modelUnknown = model.state === "unknown" || strategy.state === "unknown";
    const scheduleUnknown = row.id === "dream" && proof(["defaults", ...identityRules]).state === "unknown";
    const binding = row.id === "facts"
      ? typeof factsModel === "string" ? bindingSource("facts", "model")
        : factsCategory ? `Configured quick chain; no explicit Facts model; ${scopeLabel}.`
          : `Session strategy; no explicit Facts model; ${scopeLabel}.`
      : row.id === "recall" || row.id === "reflection" || row.id === "dream"
        ? `${row.id === "dream" ? "Shared Reflection category; " : ""}${bindingSource(row.id === "dream" ? "reflection" : row.id, "category")}` : undefined;
    return {
      ...row,
      ...(binding ? { bindingSource: model.state === "verified" ? binding : model.reasons.join(" ") } : {}),
      enabled: state.state === "verified" ? row.enabled : null,
      category: model.state === "verified" ? row.category : null,
      model: model.state === "verified" ? row.model : null,
      candidates: model.state === "verified" ? row.candidates : [],
      modelStrategy: strategy.state === "verified" ? row.modelStrategy : "unknown",
      stateSource: state.state === "verified" ? row.stateSource : state.reasons.join(" "),
      policy: modelUnknown ? [...new Set([...model.reasons, ...strategy.reasons])].join(" ") : scheduleUnknown
        ? "Dream scheduling defaults or identity overrides are unverified." : row.policy,
      semanticEvidence,
    };
  });
}
