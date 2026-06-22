import { readFileSync } from "node:fs";
import type { ReplayFile } from "./types";

/**
 * Where a resolved basic-auth password came from. Drives the masked auth
 * indicator in the TUI; never the password value itself.
 */
export type AuthSource = "cli" | "file" | "env" | "none";

export interface ConnectionInputs {
  /** CLI `--cp-id` — forces the OCPP ID for this run (highest priority). */
  cpIdForce?: string;
  /** Env `CP_ID` — global default used only when nothing else supplies an id. */
  cpIdDefault?: string;
  /** CLI `--password` — forces the basic-auth password for this run. */
  passwordForce?: string;
  /** Env `PASSWORD` — global default password. */
  passwordDefault?: string;
}

export interface ResolvedConnection {
  /** Effective OCPP ID / `chargePointId`, or undefined if no source set one. */
  cpId?: string;
  /** Effective basic-auth password, or undefined for no auth. */
  password?: string;
  authSource: AuthSource;
}

/** Treat undefined / blank strings as "not provided". */
function clean(value?: string): string | undefined {
  return value !== undefined && value.trim() !== "" ? value : undefined;
}

/**
 * Resolve the connection identity for a replay file using the precedence:
 *
 *   cpId     = cpIdForce      ?? file.stationId ?? cpIdDefault
 *   password = passwordForce  ?? file.password  ?? passwordDefault
 *
 * Force = explicit CLI flag, file = value baked into the data file, default =
 * env (`CP_ID` / `PASSWORD`). Blank values are ignored so a file always wins
 * over an empty env var.
 */
export function resolveConnection(
  file: { stationId?: string; password?: string },
  inputs: ConnectionInputs,
): ResolvedConnection {
  const cpId =
    clean(inputs.cpIdForce) ??
    clean(file.stationId) ??
    clean(inputs.cpIdDefault);

  if (clean(inputs.passwordForce) !== undefined) {
    return { cpId, password: inputs.passwordForce, authSource: "cli" };
  }
  if (clean(file.password) !== undefined) {
    return { cpId, password: file.password, authSource: "file" };
  }
  if (clean(inputs.passwordDefault) !== undefined) {
    return { cpId, password: inputs.passwordDefault, authSource: "env" };
  }
  return { cpId, password: undefined, authSource: "none" };
}

/**
 * Resolve the connection identity of a file for *display* in the TUI. Reads
 * the file's `stationId`/`password`, then returns only the effective id and
 * the auth source — never the password value, so plaintext never reaches the
 * UI layer. An unreadable or malformed file is treated as having no values, so
 * resolution falls back to the forced/default inputs without throwing.
 */
export function resolveFileConnectionForDisplay(
  path: string,
  inputs: ConnectionInputs,
): { cpId?: string; authSource: AuthSource } {
  let file: { stationId?: string; password?: string } = {};
  try {
    const parsed = JSON.parse(
      readFileSync(path, "utf8"),
    ) as Partial<ReplayFile>;
    file = { stationId: parsed.stationId, password: parsed.password };
  } catch {
    /* unreadable/malformed — resolve from forced/default inputs only */
  }
  const { cpId, authSource } = resolveConnection(file, inputs);
  return { cpId, authSource };
}
