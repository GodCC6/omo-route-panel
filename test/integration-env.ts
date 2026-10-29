import { resolve } from "node:path";

/** Integration is opt-in; never discover a developer's personal installation. */
export function integrationLauncher(): string {
  const path = process.env["OMO_LAUNCHER_PATH"];
  if (!path) throw new Error("Native integration requires OMO_LAUNCHER_PATH pointing to a supported OMO launcher.");
  return resolve(path);
}

export const integrationNode = process.env["OMO_NODE_PATH"] ? resolve(process.env["OMO_NODE_PATH"]) : process.execPath;
