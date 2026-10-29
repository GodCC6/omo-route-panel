export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export type ConfigObject = { readonly [key: string]: Json };
export type NativeFailure = {
  readonly status: "unknown" | "unsupported";
  readonly code: string;
};
export type NativeResult<T> = { readonly status: "ok"; readonly value: T } | NativeFailure;
export interface NativeContext {
  readonly project: string;
  readonly profile?: string;
}
export interface NativeOptions {
  /** Host-owned trusted paths, never user-editable configuration values. */
  readonly runtimeRoot?: string;
  readonly nodePath?: string;
  readonly launcherPath?: string;
  readonly home?: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly agentDir?: string;
  /** A running extension host supplies availability, never a second SDK runtime. */
  readonly host?: {
    readonly catalog: () => Promise<NativeCatalog>;
    readonly verify: (engine: NativeEngine) => Promise<void>;
  };
}
export interface NativeEngine {
  readonly version: string;
  readonly moduleDigest: string;
  readonly nodeVersion: string;
  readonly runtimeRoot: string;
  readonly nodePath: string;
  readonly nodeSourcePath: string;
  readonly launcherPath: string;
  readonly launcherSourcePath: string;
  readonly launcherDigest: string;
}
export interface NativeSource {
  readonly sourceId: string;
  readonly path: string;
  readonly relativePath: string;
  readonly scope: "user" | "project";
  readonly revision: string;
  /** Sanitized routing-only projection; no complete file text is returned. */
  readonly config: ConfigObject;
}
export interface NativeInspection {
  readonly engine: NativeEngine;
  readonly home: string;
  readonly project: string;
  readonly profile?: string;
  readonly files: readonly NativeSource[];
  readonly watchPaths: readonly string[];
  readonly settings: {
    readonly globalPath: string;
    readonly projectPath: string;
    readonly projectInfluence: "unknown";
    readonly pathStatus: "verified-global";
  };
}
export interface NativeModel {
  readonly provider: string;
  readonly id: string;
  readonly name?: string;
  readonly reasoning?: boolean;
  readonly input?: readonly string[];
  readonly contextWindow?: number;
  readonly maxTokens?: number;
  readonly cost?: { readonly input?: number; readonly output?: number; readonly cacheRead?: number; readonly cacheWrite?: number };
}
export type NativeCatalog = {
  readonly status: "ok";
  readonly revision: string;
  readonly capturedAt: string;
  readonly models: readonly NativeModel[];
} | NativeFailure;
export interface NativeRung {
  readonly model: string;
  readonly source: string;
  readonly state: string;
  readonly [key: string]: Json;
}
export interface NativeRoute {
  readonly kind: "category" | "agent";
  readonly name: string;
  readonly status: "resolved" | "disabled" | "unavailable";
  readonly runtime: readonly string[];
  readonly rungs: readonly NativeRung[];
  readonly primary?: string;
  readonly reason?: string;
}
export interface NativeReport {
  readonly categories: readonly NativeRoute[];
  readonly agents: readonly NativeRoute[];
  readonly excludeModels: readonly string[];
  readonly modelProfile: ConfigObject;
  readonly configProfile?: string;
}
export interface NativeView {
  readonly report: NativeReport;
  readonly doctorLines: readonly string[];
}
export interface NativeResolution {
  readonly inspection: NativeInspection;
  readonly catalogRevision: string;
  readonly equivalence: "equal";
  readonly effective: NativeView;
  readonly defaults: NativeView;
  readonly candidate?: NativeView;
}
export interface NativeResolveInput extends NativeContext {
  readonly catalog: NativeCatalog;
  /** Entire sanitized replacement projection for existing discovered sources. */
  readonly candidate?: Readonly<Record<string, ConfigObject>>;
}
export interface NativeAdapter {
  inspect(context: NativeContext): Promise<NativeResult<NativeInspection>>;
  catalog(context: NativeContext): Promise<NativeCatalog>;
  resolve(input: NativeResolveInput): Promise<NativeResult<NativeResolution>>;
}
