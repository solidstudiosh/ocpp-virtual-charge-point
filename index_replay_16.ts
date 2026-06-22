import "dotenv/config";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { runReplay } from "./src/replay/replayRunner";

interface CliArgs {
  files: string[];
  idTagOverride?: string;
  cpIdForce?: string;
  passwordForce?: string;
  downsampleMeterValues: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const files: string[] = [];
  let idTagOverride: string | undefined;
  let cpIdForce: string | undefined;
  let passwordForce: string | undefined;
  let downsampleMeterValues = false;
  for (const arg of argv) {
    if (arg.startsWith("--id-tag=")) {
      idTagOverride = arg.slice("--id-tag=".length);
    } else if (arg === "--id-tag") {
      // handled below via paired form? keep simple: require `=` form
      throw new Error("--id-tag requires =VALUE form (e.g. --id-tag=ABC123)");
    } else if (arg.startsWith("--cp-id=")) {
      cpIdForce = arg.slice("--cp-id=".length);
    } else if (arg === "--cp-id") {
      throw new Error("--cp-id requires =VALUE form (e.g. --cp-id=STATION_1)");
    } else if (arg.startsWith("--password=")) {
      passwordForce = arg.slice("--password=".length);
    } else if (arg === "--password") {
      throw new Error(
        "--password requires =VALUE form (e.g. --password=secret)",
      );
    } else if (arg === "--mv-downsample") {
      downsampleMeterValues = true;
    } else {
      files.push(arg);
    }
  }
  return {
    files,
    idTagOverride,
    cpIdForce,
    passwordForce,
    downsampleMeterValues,
  };
}

function expandInputs(inputs: string[]): string[] {
  const out: string[] = [];
  for (const input of inputs) {
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(input);
    } catch (err) {
      throw new Error(
        `cannot stat "${input}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (st.isDirectory()) {
      const entries = readdirSync(input)
        .filter((name) => name.toLowerCase().endsWith(".json"))
        .sort()
        .map((name) => join(input, name));
      if (entries.length === 0) {
        throw new Error(`no .json files found in directory "${input}"`);
      }
      out.push(...entries);
    } else {
      out.push(input);
    }
  }
  return out;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m${rem.toFixed(2)}s`;
}

async function main() {
  const {
    files: cliFiles,
    idTagOverride: cliIdTag,
    cpIdForce,
    passwordForce,
    downsampleMeterValues,
  } = parseArgs(process.argv.slice(2));
  const idTagOverride = cliIdTag ?? process.env.REPLAY_ID_TAG;
  const effectiveDownsample =
    downsampleMeterValues || process.env.REPLAY_MV_DOWNSAMPLE === "1";
  const rawInputs =
    cliFiles.length > 0
      ? cliFiles
      : process.env.REPLAY_FILE
        ? [process.env.REPLAY_FILE]
        : [];

  if (rawInputs.length === 0) {
    console.error(
      "Usage: bun run index_replay_16.ts [--id-tag=TAG] [--cp-id=ID] [--password=PW] [--mv-downsample] <file-or-dir> [more ...]",
    );
    console.error("  Directories are expanded to their *.json children.");
    console.error(
      "  --cp-id / --password force a value for every file this run; otherwise each",
    );
    console.error(
      "  file's own stationId/password is used, falling back to env CP_ID/PASSWORD.",
    );
    console.error(
      "  --mv-downsample thins MeterValues (stride 2/4 above 100/200 frames). Also: REPLAY_MV_DOWNSAMPLE=1.",
    );
    console.error("Or set REPLAY_FILE in env (single file).");
    process.exit(3);
  }

  let files: string[];
  try {
    files = expandInputs(rawInputs);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(3);
  }

  const results: Array<{
    file: string;
    exitCode: number;
    durationMs: number;
    succeeded: number;
    rejected: number;
  }> = [];
  let worstExitCode = 0;

  for (const file of files) {
    const { exitCode, summary } = await runReplay({
      replayFile: file,
      endpoint: process.env.WS_URL ?? "ws://localhost:3000",
      cpIdForce,
      cpIdDefault: process.env.CP_ID,
      passwordForce,
      passwordDefault: process.env.PASSWORD,
      idTagOverride,
      rejectionsLogPath:
        process.env.REPLAY_REJECTIONS_LOG ?? "./data/replay-rejections.log",
      runsLogPath: process.env.REPLAY_RUNS_LOG ?? "./data/replay-runs.log",
      responseTimeoutMs: Number.parseInt(
        process.env.REPLAY_RESPONSE_TIMEOUT_MS ?? "30000",
        10,
      ),
      downsampleMeterValues: effectiveDownsample,
    });
    results.push({
      file,
      exitCode,
      durationMs: summary.durationMs,
      succeeded: summary.sessionsSucceeded,
      rejected: summary.sessionsRejected,
    });
    if (exitCode > worstExitCode) worstExitCode = exitCode;
  }

  if (results.length > 1) {
    console.log("\n=== Replay run summary ===");
    const totalMs = results.reduce((acc, r) => acc + r.durationMs, 0);
    for (const r of results) {
      console.log(
        `  ${r.file}  duration=${formatDuration(r.durationMs)}  succeeded=${r.succeeded}  rejected=${r.rejected}  exitCode=${r.exitCode}`,
      );
    }
    console.log(
      `  -- total: ${formatDuration(totalMs)} across ${results.length} files`,
    );
  }

  process.exit(worstExitCode);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(3);
});
