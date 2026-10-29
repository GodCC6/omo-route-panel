import { join, resolve } from "node:path";

export function resolveAgentDir(home: string, env: Readonly<Record<string, string | undefined>>): string {
  const overridden = ["OMO_CODING_AGENT_DIR", "SENPI_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR"]
    .map((name) => env[name]?.trim()).find((value) => value);
  return overridden ? resolve(overridden) : join(home, ".omo", "agent");
}
