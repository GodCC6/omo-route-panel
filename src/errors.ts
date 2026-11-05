import { NativeError } from "./native/config.js";

export class PanelError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PanelError";
  }
}

const hostCheckHints: Readonly<Record<string, string>> = {
  "engine-launcher-invalid": "The OMO launcher is missing or is not a readable file.",
  "engine-launcher-mismatch": "Supported hosts are a globally installed npm omo-ai package or a standalone OMO runtime with an adjacent omo binary.",
  "catalog-platform": "Process executable discovery is supported on macOS and Linux only.",
  "catalog-engine-mismatch": "The running OMO engine could not be identified from its process image.",
  "node-path-invalid": "The Node.js executable is missing or unreadable; set OMO_ROUTE_PANEL_NODE_PATH to an absolute path.",
  "node-capability": "The Node.js executable lacks the restricted permission model Route Panel requires; use the supported Node version.",
};

/** Keep the failing check's safe code visible instead of folding every stage into one message. */
export function hostFailure(error: unknown, fallback: string): string {
  if (!(error instanceof NativeError)) return fallback;
  const hint = hostCheckHints[error.code];
  return `Route Panel could not verify the host installation (${error.code}).${hint === undefined ? "" : ` ${hint}`}`;
}
