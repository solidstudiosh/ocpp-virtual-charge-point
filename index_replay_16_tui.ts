import "dotenv/config";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createCliRenderer } from "@opentui/core";
import { logger } from "./src/logger";
import {
  type ConnectionInputs,
  resolveFileConnectionForDisplay,
} from "./src/replay/connection";
import { precomputeBatchTotals } from "./src/replay/plan";
import { runReplay } from "./src/replay/replayRunner";
import { createApp } from "./src/replay/tui/app";
import {
  type BeginPayload,
  type RoundChoice,
  asyncQueue,
  runBatchLoop,
} from "./src/replay/tui/batchLoop";
import { rawLogWarnings } from "./src/replay/tui/convertQueue";
import { applyThemeMode } from "./src/replay/tui/theme";
import { UiLogTransport } from "./src/replay/tui/uiLogTransport";
import type { FileStatus } from "./src/replay/tui/widgets/fileQueue";

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

async function main() {
  // OpenTUI writes "FFI is an experimental feature and might change at any
  // time" to stderr at startup, surviving --disable-warning=ExperimentalWarning.
  // Unsuppressed it corrupts the alternate screen, so this shim must land
  // before anything else touches the renderer.
  const realStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    const text =
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
    if (text.includes("FFI is an experimental feature")) return true;
    return (realStderrWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stderr.write;

  // Non-TTY runs (piped output, CI) take no input, so nothing would ever
  // quit the app on its own — the app auto-exits shortly after showing the
  // summary instead.
  const interactive = process.stdin.isTTY === true;

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

  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    // NOT `exitOnCtrlC: true`. Core handles Ctrl-C as a KEYPRESS (raw mode
    // clears ISIG, so `\x03` never becomes a SIGINT) and responds with a
    // bare `destroy()` — no `process.exit()`, no way to resolve our exit
    // promise. The batch loop's pending awaits would stall forever and the
    // process would hang. We handle Ctrl-C ourselves below instead.
    exitOnCtrlC: false,
    // `exitSignals` likewise only calls `destroy()`; the real exit codes
    // are produced by our own handlers below.
    exitSignals: ["SIGINT", "SIGTERM"],
    clearOnShutdown: true,
    targetFps: 30,
  });

  // Core cannot inherit the terminal's foreground, so pick a palette that
  // suits it. Terminals that do not answer the query fall back to dark.
  applyThemeMode((await renderer.waitForThemeMode(250)) ?? "dark");

  let resolveExit!: () => void;
  const exited = new Promise<void>((r) => {
    resolveExit = r;
  });

  const app = createApp(renderer, {
    endpoint,
    initialFiles,
    autoBegin,
    cwd: process.cwd(),
    initialIdTag: idTagOverride,
    interactive,
    onBegin: (files, tag) => begins.push({ files, idTagOverride: tag }),
    onRoundChoice: (choice) => choices.push(choice),
    onExit: () => resolveExit(),
  });
  renderer.root.add(app.root);

  // `createCliRenderer`'s `exitSignals` only tears the renderer down
  // (`destroy()`); it never calls `process.exit()`. altScreen.ts used to own
  // SIGINT/SIGTERM, restoring the terminal and forcing the conventional
  // shell exit codes — reproduce that here, or the process would hang (or
  // exit 0) instead of exiting 130/143. Declared before the keypress
  // listener below since Ctrl-C is routed through it too.
  const exitOnFatalSignal = (code: number) => {
    app.destroy();
    renderer.destroy();
    // Belt-and-suspenders, matching altScreen.ts's original SIGINT/SIGTERM
    // handling: write the raw alternate-screen-exit sequence directly too,
    // so a forced kill never leaves the terminal stuck showing the TUI
    // buffer even if `renderer.destroy()`'s own restore didn't land in
    // time. Harmless no-op when already out of the alternate screen.
    if (process.stdout.isTTY === true) process.stdout.write("\x1b[?1049l");
    process.exit(code);
  };

  renderer.keyInput.on("keypress", (e) => {
    // Ctrl-C arrives here as a keypress, never as a signal, while raw mode
    // is on (see the `exitOnCtrlC: false` comment above). Treat it exactly
    // like SIGINT.
    if (e.ctrl === true && e.name === "c") {
      exitOnFatalSignal(130);
      return;
    }
    app.handleKey(e);
  });
  // Spec lifecycle item 7: reflow instead of corrupting on resize.
  app.resize(renderer.width, renderer.height);
  renderer.on("resize", (cols: number, rows: number) => app.resize(cols, rows));
  // Belt and braces: any other path that tears the renderer down must still
  // release the batch loop, or it waits on input that can never arrive.
  renderer.on("destroy", () => resolveExit());

  const ctrl = app.controller;

  process.on("SIGINT", () => exitOnFatalSignal(130));
  process.on("SIGTERM", () => exitOnFatalSignal(143));

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
      nextBegin: () =>
        Promise.race([begins.next(), exited.then(() => undefined)]),
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
    await Promise.race([exited, Promise.resolve()]);
    app.destroy();
    renderer.destroy();
    // Land the one-line summary in normal scrollback, after the alternate
    // screen has been torn down by `renderer.destroy()`.
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
