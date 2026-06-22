import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isRawOcppLog, type RawLogEntry } from "../logConvert";

type ReadFn = (path: string) => string;
const defaultRead: ReadFn = (p) => readFileSync(p, "utf8");

function stem(filePath: string): string {
  const base = basename(filePath);
  const noExt = base.toLowerCase().endsWith(".json")
    ? base.slice(0, -".json".length)
    : base;
  return noExt.replace(/_ocpp_logs$/i, "");
}

/** Wizard prefill: filename stem with a trailing `_ocpp_logs` stripped. */
export function defaultStationId(filePath: string): string {
  return stem(filePath);
}

/** Converted file lands next to its source, never overwriting it. */
export function scenarioOutputPath(filePath: string): string {
  return join(dirname(filePath), `${stem(filePath)}_scenario.json`);
}

/** True when the file parses as a raw OCPP log export. Read/parse failures
 * are false — such files pass through untouched and the runner reports them. */
export function isRawLogFile(
  filePath: string,
  read: ReadFn = defaultRead,
): boolean {
  return readRawLogEntries(filePath, read) !== undefined;
}

export function readRawLogEntries(
  filePath: string,
  read: ReadFn = defaultRead,
): RawLogEntry[] | undefined {
  try {
    const parsed: unknown = JSON.parse(read(filePath));
    return isRawOcppLog(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export interface ConvertTask {
  sourcePath: string;
  outputPath: string;
  defaultStationId: string;
}

export function buildConvertQueue(
  paths: string[],
  read: ReadFn = defaultRead,
): ConvertTask[] {
  return paths
    .filter((p) => isRawLogFile(p, read))
    .map((p) => ({
      sourcePath: p,
      outputPath: scenarioOutputPath(p),
      defaultStationId: defaultStationId(p),
    }));
}

/** Non-interactive runs don't convert; they surface this warning instead. */
export function rawLogWarnings(
  paths: string[],
  read: ReadFn = defaultRead,
): string[] {
  return paths
    .filter((p) => isRawLogFile(p, read))
    .map(
      (p) =>
        `raw OCPP log detected — select it in the TUI (--pick) to convert: ${p}`,
    );
}
