import "dotenv/config";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "ink";
import { createElement } from "react";
import { logger } from "./src/logger";
import {
  type ConnectionInputs,
  resolveFileConnectionForDisplay,
} from "./src/replay/connection";
import { precomputeBatchTotals } from "./src/replay/plan";
import { runReplay } from "./src/replay/replayRunner";
import { App, type AppController } from "./src/replay/tui/App";
import type { FileStatus } from "./src/replay/tui/FileQueue";
import {
  enterAlternateScreen,
  exitAlternateScreen,
} from "./src/replay/tui/altScreen";
import {
  type BeginPayload,
  type RoundChoice,
  asyncQueue,
  runBatchLoop,
} from "./src/replay/tui/batchLoop";
import { rawLogWarnings } from "./src/replay/tui/convertQueue";
import { UiLogTransport } from "./src/replay/tui/uiLogTransport";

interface CliArgs {
  files: string[];
  idTagOverride?: string;
  cpIdForce?: string;
  passwordForce?: string;
  pick: boolean;
  downsampleMeterValues: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const files: string[] = [];
  let idTagOverride: string | undefined;
  let cpIdForce: string | undefined;
  let passwordForce: string | undefined;
  let pick = false;
  let downsampleMeterValues = false;
  for (const arg of argv) {
    if (arg.startsWith("--id-tag=")) {
      idTagOverride = arg.slice("--id-tag=".length);
    } else if (arg === "--id-tag") {
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
    } else if (arg === "--pick" || arg === "-p") {
      pick = true;
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
    pick,
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
      if (entries.length === 0)
        throw new Error(`no .json files found in directory "${input}"`);
      out.push(...entries);
    } else {
      out.push(input);
    }
  }
  return out;
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function main() {
  enterAlternateScreen();

  const {
    files: cliFiles,
    idTagOverride: cliIdTag,
    cpIdForce,
    passwordForce,
    pick,
    downsampleMeterValues,
  } = parseArgs(process.argv.slice(2));
  const idTagOverride = cliIdTag ?? process.env.REPLAY_ID_TAG;
  const connectionInputs: ConnectionInputs = {
    cpIdForce,
    cpIdDefault: process.env.CP_ID,
    passwordForce,
    passwordDefault: process.env.PASSWORD,
  };
  // Resolve a file's display identity (id + masked auth source) for the queue.
  const fileStatusFor = (path: string): FileStatus => ({
    path,
    status: "pending",
    ...resolveFileConnectionForDisplay(path, connectionInputs),
  });
  const effectiveDownsample =
    downsampleMeterValues || process.env.REPLAY_MV_DOWNSAMPLE === "1";
  const rawInputs =
    cliFiles.length > 0
      ? cliFiles
      : process.env.REPLAY_FILE
        ? [process.env.REPLAY_FILE]
        : [];

  let preselected: string[] = [];
  if (rawInputs.length > 0) {
    try {
      preselected = expandInputs(rawInputs);
    } catch (err) {
      process.stderr.write(
        `${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(3);
    }
  }

  const endpoint = process.env.WS_URL ?? "ws://localhost:3000";
  const initialFiles: FileStatus[] = preselected.map(fileStatusFor);

  // back-compat: files-only invocation skips the TUI selection screen.
  const autoBegin = preselected.length > 0 && !pick;

  const begins = asyncQueue<BeginPayload>();
  const choices = asyncQueue<RoundChoice>();
  const { promise: ctrlReady, resolve: resolveCtrl } =
    deferred<AppController>();

  const inkApp = render(
    createElement(App, {
      endpoint,
      initialFiles,
      autoBegin,
      cwd: process.cwd(),
      initialIdTag: idTagOverride,
      onReady: (c) => resolveCtrl(c),
      onBegin: (files, idTagOverride) => begins.push({ files, idTagOverride }),
      onRoundChoice: (choice) => choices.push(choice),
    }),
    { exitOnCtrlC: true },
  );

  // Resolves when Ink unmounts for any reason (q, Ctrl-C, non-TTY auto-exit,
  // quit from the file browser). Raced against the queues so the loop can't
  // hang on input that will never come.
  const exited = inkApp.waitUntilExit().then(
    () => undefined,
    () => undefined,
  );

  const ctrl = await ctrlReady;
  const transport = new UiLogTransport(ctrl.dispatch);
  logger.add(transport);

  // Non-interactive runs (files passed on the CLI without --pick) skip the
  // selection screen, so raw logs can't reach the conversion wizard. Warn
  // instead of silently failing in the runner.
  if (autoBegin) {
    for (const warning of rawLogWarnings(preselected)) logger.warn(warning);
  }

  let lastLine = "replay finished — no batch was run";
  let exitCode = 0;
  try {
    exitCode = await runBatchLoop({
      nextBegin: () => Promise.race([begins.next(), exited]),
      nextChoice: () =>
        Promise.race([choices.next(), exited.then(() => "quit" as const)]),
      showSummary: () => ctrl.showSummary(),
      runBatch: async ({ files, idTagOverride: effectiveIdTag }) => {
        const fileStatuses: FileStatus[] = files.map(fileStatusFor);
        ctrl.setFileStatuses(fileStatuses.slice());

        // Pre-scan the round's files to populate the batch progress totals.
        const batchTotals = precomputeBatchTotals(files, {
          downsampleMeterValues: effectiveDownsample,
        });
        ctrl.dispatch({
          type: "batch_start",
          ts: new Date().toISOString(),
          totalFiles: batchTotals.files,
          totalSessions: batchTotals.sessions,
          totalMessages: batchTotals.messages,
        });

        let worstExitCode = 0;
        let totalTruncated = 0;
        for (let i = 0; i < files.length; i++) {
          ctrl.setCurrentFileIndex(i);
          fileStatuses[i] = { ...fileStatuses[i], status: "running" };
          ctrl.setFileStatuses(fileStatuses.slice());

          const { exitCode: fileExit, summary } = await runReplay({
            replayFile: files[i],
            endpoint,
            cpIdForce: connectionInputs.cpIdForce,
            cpIdDefault: connectionInputs.cpIdDefault,
            passwordForce: connectionInputs.passwordForce,
            passwordDefault: connectionInputs.passwordDefault,
            idTagOverride: effectiveIdTag,
            rejectionsLogPath:
              process.env.REPLAY_REJECTIONS_LOG ??
              "./data/replay-rejections.log",
            runsLogPath:
              process.env.REPLAY_RUNS_LOG ?? "./data/replay-runs.log",
            responseTimeoutMs: Number.parseInt(
              process.env.REPLAY_RESPONSE_TIMEOUT_MS ?? "30000",
              10,
            ),
            onEvent: ctrl.dispatch,
            controller: ctrl.controller,
            downsampleMeterValues: effectiveDownsample,
          });

          fileStatuses[i] = {
            ...fileStatuses[i],
            status: fileExit === 0 ? "done" : "failed",
            succeeded: summary.sessionsSucceeded,
            rejected: summary.sessionsRejected,
          };
          ctrl.setFileStatuses(fileStatuses.slice());

          totalTruncated += summary.sessionsTruncated;
          if (fileExit > worstExitCode) worstExitCode = fileExit;

          if (ctrl.controller.abortRequested) break;
        }

        const totals = fileStatuses.reduce(
          (acc, f) => ({
            succeeded: acc.succeeded + (f.succeeded ?? 0),
            rejected: acc.rejected + (f.rejected ?? 0),
            filesDone: acc.filesDone + (f.status === "done" ? 1 : 0),
            filesFailed: acc.filesFailed + (f.status === "failed" ? 1 : 0),
          }),
          { succeeded: 0, rejected: 0, filesDone: 0, filesFailed: 0 },
        );
        const truncatedSuffix =
          totalTruncated > 0 ? `, ${totalTruncated} truncated` : "";
        lastLine = `replay complete — files ${totals.filesDone}/${files.length} ok, ${totals.filesFailed} failed · sessions ${totals.succeeded} succeeded, ${totals.rejected} rejected${truncatedSuffix} · exit ${worstExitCode}`;
        return worstExitCode;
      },
    });
  } finally {
    logger.remove(transport);
    // Wait for Ink to paint the final frame and unmount before tearing down.
    try {
      await inkApp.waitUntilExit();
    } catch (err) {
      process.stderr.write(
        `ink fatal: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
    // Leave the alt-screen explicitly so the one-line summary lands in normal
    // scrollback rather than the buffer we're about to tear down.
    exitAlternateScreen();
    process.stdout.write(`${lastLine}\n`);
    process.exit(exitCode);
  }
}

main().catch((err) => {
  process.stderr.write(
    `fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(3);
});
