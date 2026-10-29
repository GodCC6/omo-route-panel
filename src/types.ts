import type { BackgroundRouteEvidence } from "./background-evidence.js";

export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export type FileGroup = "native" | "settings";
export type RouteKind = "category" | "agent";
export type Candidate = {
  readonly model: string;
  readonly reasoning?: string;
  readonly status?: string;
  readonly source?: string;
  readonly providers?: readonly string[];
};
export type Route = {
  readonly kind: RouteKind;
  readonly id: string;
  readonly custom: boolean;
  readonly status: "resolved" | "disabled" | "unavailable";
  readonly defaults: readonly Candidate[];
  readonly defaultEffective?: readonly Candidate[];
  readonly override: readonly Candidate[] | null;
  readonly effective: readonly Candidate[];
  readonly ladder?: readonly Candidate[];
  readonly selected: string | null;
  readonly evidence: readonly string[];
  readonly diagnostics: readonly string[];
};
export type BackgroundRoute = {
  readonly id: string;
  readonly title: string;
  readonly enabled: boolean | null;
  readonly category: string | null;
  readonly model: string | null;
  readonly policy: string;
  readonly stateSource: string;
  readonly bindingSource?: string;
  readonly modelStrategy: "category" | "dynamic" | "fixed" | "session" | "local" | "helper" | "unknown";
  readonly candidates: readonly Candidate[];
  readonly semanticEvidence?: BackgroundRouteEvidence;
};
export type Operation =
  | { readonly kind: "set-chain"; readonly group: "native"; readonly target: RouteKind; readonly id: string; readonly models: readonly Candidate[] }
  | { readonly kind: "remove-override"; readonly group: "native"; readonly target: RouteKind; readonly id: string }
  | { readonly kind: "set-field"; readonly group: FileGroup; readonly field: string; readonly value: Json }
  | { readonly kind: "remove-field"; readonly group: FileGroup; readonly field: string };
export type FileChange = {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly beforeKind?: "unset";
  readonly afterKind?: "removed";
};
