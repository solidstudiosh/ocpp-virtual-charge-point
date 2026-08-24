import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  BoxRenderable,
  type Renderable,
  type RenderContext,
} from "@opentui/core";
import { createReplayController, type ReplayController } from "../controller";
import type { ReplayEvent } from "../events";
import { buildReplayFile, parseRawLog, type ParsedRawLog } from "../logConvert";
import {
  buildConvertQueue,
  readRawLogEntries,
  type ConvertTask,
} from "./convertQueue";
import { createKeyRouter, type KeyLike, type Phase } from "./keymap";
import {
  createConvertScreen,
  type ConvertScreenProps,
  type ConvertScreenView,
} from "./screens/convert";
import { createRunScreen, type RunScreenProps } from "./screens/run";
import {
  createSelectScreen,
  type SelectScreenProps,
  type SelectScreenView,
} from "./screens/select";
import {
  createSummaryScreen,
  type SummaryScreenProps,
  type SummaryScreenView,
} from "./screens/summary";
import { initialState, reduce, type LogEntry, type TuiState } from "./state";
import type { AnyView, View } from "./view";
import type { FileStatus } from "./widgets/fileQueue";

export interface AppController {
  dispatch: (event: ReplayEvent) => void;
  setFileStatuses: (files: FileStatus[]) => void;
  setCurrentFileIndex: (i: number) => void;
  /** Flip the app to the post-run summary screen (batch finished). */
  showSummary: () => void;
  controller: ReplayController;
}

export interface AppOptions {
  endpoint: string;
  initialFiles: FileStatus[];
  /** If true, skip the selection screen and call onBegin immediately. */
  autoBegin?: boolean;
  /** Working directory used as the root of the file browser. */
  cwd?: string;
  /** Default value of the idTag override field (e.g. from CLI/env). */
  initialIdTag?: string;
  /** Directory to write per-session log files into when file-log is enabled. */
  sessionLogDir?: string;
  /** Called when the user (or autoBegin) commits to a file set and the run should start. */
  onBegin?: (files: string[], idTagOverride?: string) => void;
  /** Called from the summary screen: run another round or quit. */
  onRoundChoice?: (choice: "again" | "quit") => void;
  /** Called when the user quits; the host tears the renderer down. */
  onExit?: () => void;
  /**
   * Whether stdin is an interactive TTY. Non-interactive runs (piped
   * output, CI) take no input, so the app auto-exits shortly after the
   * summary screen paints instead of waiting on a keypress that will never
   * come. Defaults to true.
   */
  interactive?: boolean;
}

export interface AppHandle {
  root: Renderable;
  controller: AppController;
  handleKey(key: KeyLike): void;
  /** Reflow when the terminal is resized. */
  resize(cols: number, rows: number): void;
  destroy(): void;
}

interface SessionMeta {
  stationId?: string;
  file?: string;
  sessionIndex: number;
  connectorId?: string;
  idTag?: string;
}

/** Ported verbatim from App.tsx. */
function safe(s: string | undefined): string {
  return (s ?? "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_");
}

/** Ported verbatim from App.tsx. */
function formatLogEntry(l: LogEntry): string {
  return `${l.ts} ${l.level.toUpperCase()} ${l.message}`;
}

/** Ported verbatim from App.tsx. */
function writeSessionLog(
  dir: string,
  meta: SessionMeta,
  endStatus: "done" | "rejected" | "truncated",
  buffer: LogEntry[],
): string | undefined {
  try {
    mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${safe(meta.stationId)}-s${meta.sessionIndex.toString().padStart(3, "0")}-${endStatus}-${ts}.log`;
    const full = join(dir, filename);
    const header = [
      "# replay session log",
      `# stationId=${meta.stationId ?? ""}`,
      `# sessionIndex=${meta.sessionIndex}`,
      `# connectorId=${meta.connectorId ?? ""}`,
      `# idTag=${meta.idTag ?? ""}`,
      `# file=${meta.file ?? ""}`,
      `# endStatus=${endStatus}`,
      "",
    ].join("\n");
    const body = buffer.map(formatLogEntry).join("\n");
    writeFileSync(full, `${header}${body}\n`);
    return full;
  } catch {
    return undefined;
  }
}

export function createApp(ctx: RenderContext, options: AppOptions): AppHandle {
  const root = new BoxRenderable(ctx, {
    id: "app",
    flexDirection: "column",
    flexGrow: 1,
  });

  let state: TuiState = initialState;
  let phase: Phase = options.autoBegin === true ? "running" : "selecting";
  let files = options.initialFiles.slice();
  let currentIndex = 0;
  let idTag = options.initialIdTag ?? "";
  let editingIdTag = false;
  let paused = false;
  let fileLogEnabled = false;
  let showHelp = false;
  const startedAt = Date.now();

  const replayController = createReplayController();

  // Session-log buffering. state.logs is trimmed to a fixed window, so this
  // buffer captures every log line for the currently active session — reset
  // on session_start, flushed to disk on session_done/rejected/truncated.
  let sessionLogBuffer: LogEntry[] = [];
  let sessionMeta: SessionMeta | undefined;
  let activeStationId: string | undefined;
  let activeFile: string | undefined;
  const logDir = options.sessionLogDir ?? "./data/replay-session-logs";

  // Exactly one screen is alive at a time.
  let current: AnyView | undefined;
  let select: SelectScreenView | undefined;
  let convert: ConvertScreenView | undefined;
  let summary: SummaryScreenView | undefined;

  /** Terminal size, refreshed from the renderer on every resize. */
  let width = 90;
  let height = 24;

  const selectProps = (): SelectScreenProps => ({
    cwd: options.cwd ?? process.cwd(),
    selected: files.map((f) => f.path),
    fileStatusFor: (path: string): FileStatus => ({ path, status: "pending" }),
    idTag,
    editingIdTag,
    width,
    height,
  });

  const runProps = (): RunScreenProps => ({
    state,
    files,
    currentIndex,
    width,
    height,
    elapsedMs: Date.now() - startedAt,
    paused,
    fileLogEnabled,
    showHelp,
  });

  const summaryProps = (): SummaryScreenProps => ({
    fileResults: state.fileResults,
    files,
    width,
    height,
  });

  // The convert queue, built when the user presses `v` or `B` in the select
  // screen over a selection containing raw OCPP logs. NOTE: ConvertTask
  // carries only { sourcePath, outputPath, defaultStationId }. The parse
  // stats and the error string are NOT on the task — they come from parsing
  // the file, and are held alongside it, exactly as App.tsx does.
  let convertTasks: ConvertTask[] = [];
  let convertIndex = 0;
  let convertParsed: ParsedRawLog | undefined;
  let convertError: string | undefined;
  // Remembers the picks so cancel/skip can restore or advance them; path
  // swaps replace a raw source with its converted output as tasks complete.
  let pendingPaths: string[] = [];
  // Distinguishes the two triggers into the converting phase: "run" (begin →
  // convert-then-run) vs "select" (v → convert-only, back to selection).
  let convertMode: "run" | "select" = "run";

  /** Read and parse a task's raw log. Ported from App.tsx's loadConvertTask. */
  const loadConvertTask = (task: ConvertTask) => {
    const entries = readRawLogEntries(task.sourcePath);
    if (entries === undefined) {
      convertParsed = undefined;
      convertError = "could not parse raw log";
      return;
    }
    convertParsed = parseRawLog(entries);
    convertError =
      convertParsed.sessionCount === 0
        ? "no replayable sessions found"
        : undefined;
  };

  const resetConvertState = () => {
    convertTasks = [];
    convertIndex = 0;
    convertParsed = undefined;
    convertError = undefined;
    pendingPaths = [];
  };

  const convertPropsForCurrentTask = (): ConvertScreenProps => {
    const task = convertTasks[convertIndex];
    return {
      fileLabel: task === undefined ? "" : basename(task.sourcePath),
      index: convertIndex,
      total: convertTasks.length,
      initialStationId: task?.defaultStationId ?? "",
      stats:
        convertParsed === undefined
          ? undefined
          : {
              calls: convertParsed.stats.keptCalls,
              sessions: convertParsed.sessionCount,
              dropped: convertParsed.stats.droppedFrames,
              corrupt: convertParsed.stats.corruptEntries,
            },
      error: convertError,
      width,
      height,
    };
  };

  /** Push current state into whichever screen is mounted. */
  const rerender = () => {
    if (phase === "selecting") select?.update(selectProps());
    else if (phase === "running") {
      (current as View<RunScreenProps> | undefined)?.update(runProps());
    } else if (phase === "complete") summary?.update(summaryProps());
    else if (phase === "converting" && convert !== undefined) {
      convert.update(convertPropsForCurrentTask());
    }
  };

  /** Destroy the outgoing screen and build the incoming one. */
  const mountScreen = (next: Phase) => {
    current?.destroy();
    current = undefined;
    select = undefined;
    convert = undefined;
    summary = undefined;
    phase = next;

    if (next === "selecting") {
      select = createSelectScreen(ctx, selectProps());
      current = select;
    } else if (next === "running") {
      current = createRunScreen(ctx, runProps());
    } else if (next === "complete") {
      summary = createSummaryScreen(ctx, summaryProps());
      current = summary;
    } else {
      convert = createConvertScreen(ctx, convertPropsForCurrentTask());
      current = convert;
    }
    root.add(current.root);
  };

  const startRun = (selectedPaths: string[]) => {
    if (selectedPaths.length === 0) return;
    files = selectedPaths.map((path) => ({ path, status: "pending" }));
    currentIndex = 0;
    mountScreen("running");
    options.onBegin?.(selectedPaths, idTag.trim() || undefined);
  };

  const beginRun = (selectedPaths: string[]) => {
    if (selectedPaths.length === 0) return;
    const queue = buildConvertQueue(selectedPaths);
    if (queue.length === 0) {
      startRun(selectedPaths);
      return;
    }
    files = selectedPaths.map((path) => ({ path, status: "pending" }));
    pendingPaths = selectedPaths;
    convertTasks = queue;
    convertIndex = 0;
    convertMode = "run";
    loadConvertTask(queue[0]);
    mountScreen("converting");
  };

  // Convert-only ("v"): convert the raw logs in the selection, then return to
  // the selection screen with the outputs selected — never runs. No-op when
  // the selection holds no raw logs.
  const convertOnly = (selectedPaths: string[]) => {
    if (selectedPaths.length === 0) return;
    const queue = buildConvertQueue(selectedPaths);
    if (queue.length === 0) return;
    files = selectedPaths.map((path) => ({ path, status: "pending" }));
    pendingPaths = selectedPaths;
    convertTasks = queue;
    convertIndex = 0;
    convertMode = "select";
    loadConvertTask(queue[0]);
    mountScreen("converting");
  };

  const returnToSelection = (paths: string[]) => {
    files = paths.map((path) => ({ path, status: "pending" }));
    mountScreen("selecting");
  };

  const advanceConvert = (nextPaths: string[]) => {
    const next = convertIndex + 1;
    if (next < convertTasks.length) {
      pendingPaths = nextPaths;
      convertIndex = next;
      loadConvertTask(convertTasks[next]);
      rerender();
      return;
    }
    const mode = convertMode;
    resetConvertState();
    if (mode === "select") {
      returnToSelection(nextPaths);
      return;
    }
    if (nextPaths.length === 0) {
      mountScreen("selecting");
      return;
    }
    startRun(nextPaths);
  };

  const handleConvertAccept = () => {
    const task = convertTasks[convertIndex];
    if (task === undefined || convertParsed === undefined) return;
    if (convert === undefined) return;
    const values = convert.values();
    try {
      const file = buildReplayFile(convertParsed, {
        stationId: values.stationId,
        password: values.password || undefined,
        rebaseTimestamps: values.rebaseTimestamps,
        now: new Date(),
      });
      writeFileSync(task.outputPath, `${JSON.stringify(file, null, 2)}\n`);
      advanceConvert(
        pendingPaths.map((p) => (p === task.sourcePath ? task.outputPath : p)),
      );
    } catch (err) {
      convertError = `write failed: ${err instanceof Error ? err.message : String(err)}`;
      rerender();
    }
  };

  const handleConvertSkip = () => {
    const task = convertTasks[convertIndex];
    if (task === undefined) return;
    advanceConvert(pendingPaths.filter((p) => p !== task.sourcePath));
  };

  const handleConvertCancel = () => {
    // In convert-only mode, keep any files already written (pendingPaths
    // holds the accumulated raw→output swaps) selected on return.
    const mode = convertMode;
    const paths = pendingPaths;
    resetConvertState();
    if (mode === "select") {
      returnToSelection(paths);
      return;
    }
    mountScreen("selecting");
  };

  const keyRouter = createKeyRouter({
    getPhase: () => phase,
    getContext: () => ({
      canBegin: select !== undefined && select.selection().length > 0,
    }),
    onAction: (action, key) => {
      if (phase === "selecting") {
        if (select === undefined) return;
        switch (action) {
          case "move":
            select.move(key.name === "up" ? -1 : 1);
            return;
          case "page":
            select.page(key.name === "pageup" ? -1 : 1);
            return;
          case "open":
            select.open();
            return;
          case "toggle":
            select.toggle();
            return;
          case "up":
            select.up();
            return;
          case "selectAll":
            select.selectAll();
            return;
          case "clear":
            select.clear();
            return;
          case "editIdTag":
            editingIdTag = true;
            rerender();
            return;
          case "convert":
            convertOnly(select.selection());
            return;
          case "begin":
            beginRun(select.selection());
            return;
          case "quit":
            options.onExit?.();
            return;
        }
        return;
      }

      if (phase === "converting") {
        if (convert === undefined) return;
        switch (action) {
          case "field":
            convert.field(key.name === "up" ? -1 : 1);
            return;
          case "toggleRebase":
            convert.toggleRebase();
            return;
          case "accept":
            if (convert.isErrorMode()) handleConvertSkip();
            else if (convert.canAccept()) handleConvertAccept();
            return;
          case "cancel":
            handleConvertCancel();
            return;
        }
        return;
      }

      if (phase === "running") {
        switch (action) {
          case "pause":
            replayController.togglePause();
            paused = replayController.paused;
            rerender();
            return;
          case "stop":
            replayController.requestStop();
            return;
          case "abort":
            replayController.requestAbort();
            return;
          case "toggleFileLog":
            fileLogEnabled = !fileLogEnabled;
            rerender();
            return;
          case "toggleHelp":
            showHelp = !showHelp;
            rerender();
            return;
        }
        return;
      }

      if (phase === "complete") {
        if (summary === undefined) return;
        switch (action) {
          case "scroll":
            summary.scroll(key.name === "up" ? -1 : 1);
            return;
          case "scrollPage":
            summary.scrollPage(key.name === "pageup" ? -1 : 1);
            return;
          case "again":
            replayController.reset();
            paused = false;
            showHelp = false;
            files = [];
            currentIndex = 0;
            mountScreen("selecting");
            options.onRoundChoice?.("again");
            return;
          case "quit":
            options.onRoundChoice?.("quit");
            options.onExit?.();
            return;
        }
      }
    },
  });

  mountScreen(phase);

  // Ported from App.tsx's autoBegin effect: files-only CLI invocations skip
  // the selection screen and start the batch immediately.
  if (options.autoBegin === true && options.initialFiles.length > 0) {
    options.onBegin?.(
      options.initialFiles.map((f) => f.path),
      options.initialIdTag || undefined,
    );
  }

  const handleKey = (key: KeyLike) => {
    // Modal text input for the idTag override field: while active it owns
    // the keyboard, and no other binding fires.
    if (editingIdTag) {
      if (key.name === "return") {
        idTag = select?.idTagValue() ?? idTag;
        editingIdTag = false;
        rerender();
      } else if (key.name === "escape") {
        editingIdTag = false;
        rerender();
      }
      return;
    }
    keyRouter.handle(key);
  };

  return {
    root,
    controller: {
      dispatch(event) {
        // Side effects mirrored from App.tsx's wrappedDispatch: track the
        // active station/file, buffer per-session log lines, and flush them
        // to disk on session end when file-logging is enabled.
        switch (event.type) {
          case "run_start":
            activeStationId = event.stationId;
            activeFile = event.file;
            break;
          case "session_start":
            sessionLogBuffer = [];
            sessionMeta = {
              stationId: activeStationId,
              file: activeFile,
              sessionIndex: event.sessionIndex,
              connectorId: event.connectorId,
              idTag: event.idTag,
            };
            break;
          case "log":
            sessionLogBuffer.push({
              ts: event.ts,
              level: event.level,
              message: event.message,
            });
            break;
          case "session_done":
          case "session_rejected":
          case "session_truncated": {
            if (fileLogEnabled && sessionMeta !== undefined) {
              const endStatus =
                event.type === "session_done"
                  ? "done"
                  : event.type === "session_rejected"
                    ? "rejected"
                    : "truncated";
              const written = writeSessionLog(
                logDir,
                sessionMeta,
                endStatus,
                sessionLogBuffer,
              );
              if (written !== undefined) {
                state = reduce(state, {
                  type: "log",
                  ts: new Date().toISOString(),
                  level: "info",
                  message: `session log written ${written}`,
                });
              }
            }
            break;
          }
        }
        state = reduce(state, event);
        rerender();
      },
      setFileStatuses(next) {
        files = next;
        rerender();
      },
      setCurrentFileIndex(i) {
        currentIndex = i;
        rerender();
      },
      showSummary() {
        mountScreen("complete");
        // Non-TTY runs take no input, so nothing would ever quit the app.
        // Exit shortly after the final frame paints, matching the Ink
        // behaviour.
        if (options.interactive === false) {
          setTimeout(() => options.onExit?.(), 100);
        }
      },
      controller: replayController,
    },
    handleKey,
    resize(cols, rows) {
      width = cols;
      height = rows;
      rerender();
    },
    destroy() {
      current?.destroy();
      root.destroyRecursively();
    },
  };
}
