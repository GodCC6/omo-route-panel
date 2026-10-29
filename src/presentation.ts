import { nodeValue } from "./config.js";
import type { Document } from "./config.js";
import type { NativeInspection, NativeReport, NativeRoute } from "./native/index.js";
import type { Candidate, Json, Route } from "./types.js";

export type PresentedRoute = Route & {
  readonly routeReasoning?: Readonly<Record<string, Json>>;
};

export function record(value: Json | undefined): Readonly<Record<string, Json>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value)) : {};
}

function ladder(route: NativeRoute | undefined): readonly Candidate[] {
  return route?.rungs.map((rung) => ({
    model: rung.model, source: rung.source, status: rung.state,
    ...(typeof rung["reasoning"] === "string" ? { reasoning: rung["reasoning"] } : {}),
    ...(Array.isArray(rung["providers"]) ? { providers: rung["providers"].filter((item): item is string => typeof item === "string") } : {}),
  })) ?? [];
}

function explicit(value: Json | undefined): readonly Candidate[] | null {
  const entry = record(value);
  const candidate = (item: Json): readonly Candidate[] => {
    if (typeof item === "string") return [{ model: item }];
    const declared = record(item);
    const reasoning = typeof declared["reasoning"] === "string" ? declared["reasoning"] : undefined;
    return typeof declared["model"] === "string"
      ? [{ model: declared["model"], ...(reasoning ? { reasoning } : {}) }] : [];
  };
  if (Array.isArray(entry["models"])) return entry["models"].flatMap(candidate);
  if (typeof entry["model"] !== "string") return null;
  const fallback = entry["fallback_models"];
  return [entry["model"], ...(Array.isArray(fallback) ? fallback : fallback === undefined ? [] : [fallback])].flatMap(candidate);
}

/** Declared choices only. The installed oracle still validates the candidate. */
export function declaredModelProfiles(inspection: NativeInspection, activeProfile = inspection.profile): readonly string[] {
  const names = new Set<string>();
  const visit = (config: Json | undefined, selectProfile: boolean): void => {
    const layer = record(config);
    for (const name of Object.keys(record(layer["model_profiles"]))) names.add(name);
    for (const harness of ["[senpi]", "[native]"]) if (layer[harness] !== undefined) visit(layer[harness], selectProfile);
    if (selectProfile && activeProfile) visit(record(layer["profiles"])[activeProfile], false);
  };
  for (const file of inspection.files) visit(file.config, true);
  return [...names];
}

/** Display projections only; every ladder and effective chain comes from OMO. */
export function presentRoutes(report: NativeReport, defaults: NativeReport, doc: Document, inspection: NativeInspection): readonly PresentedRoute[] {
  return [...report.categories, ...report.agents].map((route) => {
    const key = route.kind === "category" ? "categories" : "agents";
    const baseline = [...defaults.categories, ...defaults.agents].find((entry) => entry.kind === route.kind && entry.name === route.name);
    const evidence: string[] = [];
    for (const file of inspection.files) {
      const visit = (config: Json, prefix: string): void => {
        const value = record(config);
        const declaration = record(value[key])[route.name];
        if (declaration !== undefined) evidence.push(`${file.path} :: ${prefix}${key}.${route.name} = ${JSON.stringify(declaration)} (declared layer, not inferred final provenance)`);
        for (const harness of ["[native]", "[senpi]"]) if (value[harness] !== undefined) visit(value[harness], `${prefix}${harness}.`);
        for (const [profile, profileConfig] of Object.entries(record(value["profiles"]))) visit(profileConfig, `${prefix}profiles.${profile}.`);
      };
      visit(file.config, "");
    }
    const declaration = record(nodeValue(doc, ["[native]", key, route.name]));
    return {
      kind: route.kind, id: route.name, custom: baseline === undefined, status: route.status,
      defaults: ladder(baseline), defaultEffective: baseline?.runtime.map((model) => ({ model })) ?? [],
      override: explicit(nodeValue(doc, ["[native]", key, route.name])),
      routeReasoning: Object.fromEntries(["reasoning", "reasoningEffort", "variant"].flatMap((name) =>
        declaration[name] === undefined ? [] : [[name, declaration[name]]])),
      effective: route.runtime.map((model) => ({ model })), ladder: ladder(route),
      selected: route.primary ?? null,
      evidence: [...evidence, "Override editing targets user [native] nodes. Removing those nodes restores inheritance from remaining layers.",
        "Reasoning absent from the native report is not a confirmed effective reasoning level."],
      diagnostics: [...(route.reason ? [route.reason] : []), ...(report.excludeModels.length ? [`Excluded models: ${report.excludeModels.join(", ")}`] : [])],
    };
  });
}
