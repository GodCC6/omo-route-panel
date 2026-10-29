import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

/**
 * Recorded source contracts, inspected on 2026-10-29. These are deliberately
 * exact, bounded implementation fragments, not a version/digest allowlist.
 * A new minification or implementation needs a new source inspection.
 */
export const backgroundSourceContracts = {
  defaults: {
    affectedFields: ["memory.enabled", "*.enabled", "recall.category", "reflection.category", "dream.policy"],
    fragments: [
      'hu=kd({enabled:pd().default(!0),agent:Dl().min(1).default("auto"),auto_identity:pu.default("path"),reflection:zc.default({enabled:!0,trigger:{step_count:25,on_compaction:!0},merge:"auto",category:"quick",timeout_minutes:15,max_concurrent_runs:1,sandbox:"auto"}),nudge:Gc.default({enabled:!0,every_user_turns:10}),facts:Kc.default({enabled:!0,debounce_settles:4}),dream:Yc.default({enabled:!0,idle_minutes:30,min_hours_between:24,shutdown_launch:!0,auto_select_max:5,auto_select_max_chars:15e4})',
      'sync:Fc.default({enabled:!0}),search:Uc.default({enabled:!0}),recall:Wc.default({enabled:!0,max_items:2,category:"quick"',
      'function b0(e){return e??hu.parse({})}',
    ],
  },
  globalGate: {
    affectedFields: ["recall.enabled", "reflection.enabled", "dream.enabled", "facts.enabled", "nudge.enabled", "sync.enabled"],
    fragments: [
      'function wae(e){return b0(e.config.memory)}',
      'function _ae(e,t,n){return e.enabled&&!function(e){return bae.some(t=>"1"===e[t])}(n)&&!0!==t.config.getFlag("omo-senpi-disabled")&&!0!==t.config.getFlag("omo-senpi-memory-disabled")}',
      'let p=e.resolveConfig(a({cwd:o})),h=f.existing??{enabled:e.isEnabled(p),memoryStatusAttempted:!1,restartNotified:!1,conflictNotified:!1,...void 0===c.ui?{}:{ui:c.ui}};if(s.set(c.id,h),!h.enabled)return;',
      'isEnabled:e=>_ae(e,s,r),resolveConfig:wae',
    ],
  },
  identityOverrides: {
    affectedFields: ["recall.*", "reflection.*", "dream.*", "facts.*", "nudge.enabled"],
    fragments: [
      'function _0(e,t){let n=b0(e),r=n.reflection,i=n.agents[t]?.reflection;return{...r,...i,trigger:{...r.trigger,...i?.trigger}}}',
      'function C7(e,t){let n=b0(e),r=n.recall,i=n.agents[t]?.recall;return{...r,...i,event_caps:{...r.event_caps,...i?.event_caps}}}',
      'let n=e.dream,r=void 0===t?void 0:e.agents[t]?.dream;return{enabled:r?.enabled??n.enabled,idleMinutes:r?.idle_minutes??n.idle_minutes,minHoursBetween:r?.min_hours_between??n.min_hours_between,shutdownLaunch:r?.shutdown_launch??n.shutdown_launch,autoSelectMax:r?.auto_select_max??n.auto_select_max,autoSelectMaxChars:r?.auto_select_max_chars??n.auto_select_max_chars}',
      'return t.agents[n.identity]?.facts?.enabled??t.facts.enabled',
      'r=n.agents[t]?.nudge;return{enabled:r?.enabled??n.nudge.enabled,everyUserTurns:r?.every_user_turns??n.nudge.every_user_turns}',
    ],
  },
  identityDerivation: {
    affectedFields: ["identity-dependent memory fields"],
    fragments: [
      'import{basename as OP,join as NP,resolve as CP}from"node:path";var PP="auto",RP="agent",jP={exists:wC};',
      'function MP(e){return e.normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").toLowerCase()}',
      'function DP(e){let t=MP(e).replace(/[^\\p{L}\\p{M}\\p{N}]+/gu,"-").normalize("NFC").replace(/-{2,}/g,"-").replace(/^-+|-+$/g,""),n=Array.from(t).slice(0,40).join("").replace(/-+$/g,"");return""===n?RP:n}',
      'function zP(e,t){let n=(o=e,$P("sha256").update(o,"utf8").digest("hex").slice(0,8)),r=DP(t)',
      'function qP(e,t=process.env,n="path",r=jP){return FP(e,"resolveAutoIdentity"),UP(function(e,t,n){if("git"===t){let t=vP(e,n);if(void 0!==t)return zP(t.hashSource,t.slugSource)}let r=CP(e);return zP(r,OP(r))}(e,n,r.gitLayout),e,t,r)}',
      'function UP(e,t,n,r){let i=ZC(n,t),o=function(e,t,n){if(e.legacy.id===e.id)return e;let r=NP(t,YC);return n.exists(NP(r,e.id))?e:n.exists(NP(r,e.legacy.id))?e.legacy:e}(e,i,r);return{id:o.id,safeSlug:o.safeSlug,paths:XC(i,o.id)}}',
      'function WP(e,t,n=process.env,r=jP){FP(t,"resolveMemoryIdentity");let i="string"==typeof e?e.trim():"";return""===i||i===PP?qP(t,n,"path",r):UP(zP(o=i,o),t,n,r);var o}',
    ],
  },
  syncGlobal: {
    affectedFields: ["sync.enabled"],
    fragments: [
      'd.acquire(b.id,b.paths,p.sync,{profile:p.agent,projectDir:m})',
      'async acquire(t,n,r,i){if(!r.enabled)return;',
    ],
  },
  factsModel: {
    affectedFields: ["facts.model", "facts.modelStrategy", "facts.candidates"],
    fragments: [
      'a=e.memory?.agents?.[r]?.facts?.model??e.memory?.facts?.model,s=e.categories?.quick',
      'let d=a??(void 0===o?void 0:`${o.provider}/${o.id}`);if(void 0===i||void 0===d)return{kind:"category_unavailable",category:"quick",cause:void 0===i?"no_registry":"not_found"};',
    ],
  },
  factsQuick: {
    affectedFields: ["facts.category", "facts.modelStrategy", "facts.candidates"],
    fragments: [
      'if(void 0===a&&!0===s?.disable)return{kind:"category_unavailable",category:"quick",cause:"not_found"};if(void 0===a&&void 0!==s&&(void 0!==s.model||(s.models?.length??0)>0)){let t=L2("quick",e,i);',
      'let n=new Set([...void 0===s.model?[]:[s.model],...(s.models??[]).map(e=>"string"==typeof e?e:e.model),...void 0===s.fallback_models?[]:(Array.isArray(s.fallback_models)?s.fallback_models:[s.fallback_models]).map(e=>"string"==typeof e?e:e.model)]);return n.has(t.model)&&l.has(t.model)?{...t,fallbacks:t.fallbacks.filter(e=>n.has(e.model))}',
    ],
  },
  dreamReflection: {
    affectedFields: ["dream.category", "dream.modelStrategy", "dream.candidates"],
    fragments: [
      'i=_0(r.config.memory,this.options.identity.id).category,o=this.options.resolveModelRegistry(),a=this.options.resolveSessionModel?.(),s=L2(i,r.config,o,{...void 0===a?{}:{sessionModel:a}})',
      '"dream"===e.request.trigger?"dream":"reflection"',
    ],
  },
  reflectionDynamic: {
    affectedFields: ["reflection.modelStrategy", "dream.modelStrategy"],
    fragments: [
      'if(void 0===r.cost)return H2("quick",n,"no_pricing");if(void 0===e.parentContextTokens)return H2("quick",n,"unknown_context");if(void 0!==r.contextWindow&&e.parentContextTokens+3800+(e.payloadTokens??0)+500*e.turns>.8*r.contextWindow)return H2("quick",n,"window_unfit");',
      'o<a?{...H2("fork",r,"cheaper"),forkCost:o,quickCost:a}:{...H2("quick",n,"cheaper"),forkCost:o,quickCost:a}',
    ],
  },
} as const;

export type BackgroundRule = keyof typeof backgroundSourceContracts;
export type BackgroundArtifact = {
  readonly path: string;
  readonly realPath: string;
  readonly digest: string;
};
export type BackgroundRuleEvidence = {
  readonly status: "verified" | "unknown";
  readonly reason: string;
  readonly method: "recorded-source-contract";
  readonly affectedFields: readonly string[];
  readonly references: readonly { readonly path: string; readonly offset: number; readonly length: number; readonly digest: string }[];
};
export type BackgroundEvidence = {
  readonly checkedAt: string;
  readonly runtimeRoot: string;
  readonly artifacts: readonly BackgroundArtifact[];
  readonly rules: Readonly<Record<BackgroundRule, BackgroundRuleEvidence>>;
};
export type BackgroundRouteEvidence = {
  readonly state: "verified" | "unknown";
  readonly rules: readonly string[];
  readonly reasons: readonly string[];
};

const bindings = new Map<string, BackgroundArtifact>();
const sha256 = (text: string | Uint8Array): string => createHash("sha256").update(text).digest("hex");

/** Only implementation artifacts; never configuration, credentials or sessions. */
export function backgroundEvidencePaths(runtimeRoot: string): readonly string[] {
  return [join(resolve(runtimeRoot), "plugin", "extensions", "omo.js")];
}

/**
 * Static source inspection only: no import, subprocess, hook or model call.
 * Once bound, a changed artifact stays unknown until a fresh source-contract
 * inspection in a new process. Restoring the exact bound artifact is safe.
 */
export async function loadBackgroundEvidence(runtimeRoot: string): Promise<BackgroundEvidence> {
  const root = resolve(runtimeRoot);
  const path = join(root, "plugin", "extensions", "omo.js");
  let source = "";
  let artifact: BackgroundArtifact | undefined;
  let failure = "";
  try {
    const resolvedRoot = await realpath(root);
    const realPath = await realpath(path);
    const location = relative(resolvedRoot, realPath);
    if (location === ".." || location.startsWith("../") || isAbsolute(location)) {
      failure = "Background implementation artifact resolves outside the selected runtime.";
    } else {
      const handle = await open(realPath, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size > 8 * 1024 * 1024) {
          failure = "Background implementation artifact is not a bounded regular source file.";
        } else {
          const bytes = await handle.readFile();
          const after = await handle.stat();
          source = bytes.toString("utf8");
          artifact = { path, realPath, digest: sha256(bytes) };
          const previous = bindings.get(root);
          if (info.size !== after.size || info.mtimeMs !== after.mtimeMs || info.ctimeMs !== after.ctimeMs
            || await realpath(path) !== realPath || (previous && (previous.realPath !== realPath || previous.digest !== artifact.digest))) {
            failure = "Background implementation artifact changed since its recorded source inspection.";
          } else if (!previous) {
            bindings.set(root, artifact);
          }
        }
      } finally {
        await handle.close();
      }
    }
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    // Do not expose file contents, OS messages or unexpected paths.
    failure = "Background implementation artifact could not be read safely.";
  }
  const entries = Object.entries(backgroundSourceContracts).map(([rule, contract]) => {
    const references = contract.fragments.flatMap((fragment) => {
      const offset = source.indexOf(fragment);
      return offset >= 0 && source.lastIndexOf(fragment) === offset
        ? [{ path, offset, length: fragment.length, digest: sha256(fragment) }] : [];
    });
    const reason = failure || (references.length !== contract.fragments.length
      ? `Recorded source contract for ${rule} is missing or ambiguous.` : "");
    return [rule, {
      status: reason ? "unknown" : "verified", reason,
      method: "recorded-source-contract", affectedFields: contract.affectedFields, references,
    }] as const;
  });
  // Keep the finite rule mapping checked by TypeScript without asserting parsed input.
  const rules = Object.fromEntries(entries);
  const rule = (id: BackgroundRule): BackgroundRuleEvidence => {
    const value = rules[id];
    if (!value) throw new TypeError(`Missing internal background rule: ${id}`);
    return value;
  };
  return {
    checkedAt: new Date().toISOString(), runtimeRoot: root,
    artifacts: artifact ? [artifact] : [],
    rules: {
      defaults: rule("defaults"), globalGate: rule("globalGate"), identityOverrides: rule("identityOverrides"),
      identityDerivation: rule("identityDerivation"), syncGlobal: rule("syncGlobal"),
      factsModel: rule("factsModel"), factsQuick: rule("factsQuick"),
      dreamReflection: rule("dreamReflection"), reflectionDynamic: rule("reflectionDynamic"),
    },
  };
}
