import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Box, Text, useApp, useInput, useStdin } from "ink";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReplayController } from "../controller";
import { createReplayController } from "../controller";
import type { ReplayEvent } from "../events";
import { parseRawLog, buildReplayFile, type ParsedRawLog } from "../logConvert";
import { ConvertWizard } from "./ConvertWizard";
import {
  buildConvertQueue,
  type ConvertTask,
  readRawLogEntries,
} from "./convertQueue";
import { FileBrowser } from "./FileBrowser";
import { FileDots, FileQueue, type FileStatus } from "./FileQueue";
import { Frame, frameInnerHeight, frameInnerWidth } from "./Frame";
import { HelpBar, HelpDetails, shortKeys } from "./HelpBar";
import { IdTagInput } from "./IdTagInput";
import { LogTail } from "./LogTail";
import { ProgressStrip } from "./ProgressStrip";
import { Rule } from "./Rule";
import { SessionList } from "./SessionList";
import { SummaryScreen } from "./SummaryScreen";
import { fmtDuration } from "./format";
import { useTerminalSize } from "./layout";
import { type LogEntry, initialState, reduce } from "./state";
import { color, icon } from "./theme";

export interface AppController {
  dispatch: (event: ReplayEvent) => void;
  setFileStatuses: (files: FileStatus[]) => void;
  setCurrentFileIndex: (i: number) => void;
  /** Flip the app to the post-run summary screen (batch finished). */
  showSummary: () => void;
  controller: ReplayController;
}

interface Props {
  endpoint: string;
  initialFiles: FileStatus[];
  /** If true, skip the selection/ready screens and call onBegin immediately. */
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
  onReady: (controller: AppController) => void;
}

type AppPhase = "selecting" | "ready" | "converting" | "running" | "complete";

/** Below this inner width the body stacks vertically instead of two columns. */
const NARROW_COLS = 56;
/** Rows reserved for the expanded `?` help block. */
const HELP_ROWS = 5;

interface SessionMeta {
  stationId?: string;
  file?: string;
  sessionIndex: number;
  connectorId?: string;
  idTag?: string;
}

function safe(s: string | undefined): string {
  return (s ?? "unknown").replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function formatLogEntry(l: LogEntry): string {
  return `${l.ts} ${l.level.toUpperCase()} ${l.message}`;
}

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

export function App({
  endpoint,
  initialFiles,
  autoBegin = false,
  cwd,
  initialIdTag,
  sessionLogDir,
  onBegin,
  onRoundChoice,
  onReady,
}: Props) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [files, setFiles] = useState<FileStatus[]>(initialFiles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const [appPhase, setAppPhase] = useState<AppPhase>(() => {
    if (autoBegin && initialFiles.length > 0) return "running";
    if (initialFiles.length > 0) return "ready";
    return "selecting";
  });
  const [idTag, setIdTag] = useState<string>(initialIdTag ?? "");
  const [idTagDraft, setIdTagDraft] = useState<string>(initialIdTag ?? "");
  const [editingIdTag, setEditingIdTag] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [fileLogEnabled, setFileLogEnabled] = useState(false);
  const [pickerCount, setPickerCount] = useState(initialFiles.length);
  const [browserCwd, setBrowserCwd] = useState<string>(cwd ?? process.cwd());
  const [convertQueue, setConvertQueue] = useState<ConvertTask[]>([]);
  const [convertIndex, setConvertIndex] = useState(0);
  const [convertParsed, setConvertParsed] = useState<ParsedRawLog | undefined>(
    undefined,
  );
  const [convertError, setConvertError] = useState<string | undefined>(
    undefined,
  );
  const [pendingPaths, setPendingPaths] = useState<string[]>([]);
  // Distinguishes the two triggers into the converting phase: "run" (begin →
  // convert-then-run) vs "select" (v → convert-only, back to selection).
  const [convertMode, setConvertMode] = useState<"run" | "select">("run");
  // Bumped to remount FileBrowser so it re-reads the directory (picking up
  // freshly written _scenario.json files) and re-seeds its selection.
  const [browserNonce, setBrowserNonce] = useState(0);
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { cols, rows } = useTerminalSize();
  const innerW = frameInnerWidth(cols);
  const innerH = frameInnerHeight(rows);
  const onReadyCalled = useRef(false);
  const autoBeginFired = useRef(false);
  const controllerRef = useRef<ReplayController>(createReplayController());

  // Session-log buffering. We can't rely on state.logs here because it's
  // trimmed to a fixed window. These refs are written from inside the wrapped
  // dispatch so we capture every log event for the active session.
  const fileLogEnabledRef = useRef(fileLogEnabled);
  const sessionLogBufferRef = useRef<LogEntry[]>([]);
  const sessionMetaRef = useRef<SessionMeta | undefined>(undefined);
  const stationIdRef = useRef<string | undefined>(undefined);
  const currentFileRef = useRef<string | undefined>(undefined);
  const logDir = sessionLogDir ?? "./data/replay-session-logs";

  // Render coalescing. Replay events arrive synchronously and can flood
  // (per-message, across concurrent sessions). We buffer them and flush on the
  // next macrotask, replaying the whole batch through the reducer in one go —
  // React 18 batches those dispatches into a single re-render. This caps the
  // render rate regardless of event throughput. Side effects (session-log
  // writes) stay synchronous in wrappedDispatch so no log line is ever dropped.
  const eventBufferRef = useRef<ReplayEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const enqueue = useCallback(
    (event: ReplayEvent) => {
      eventBufferRef.current.push(event);
      if (flushTimerRef.current !== undefined) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = undefined;
        const batch = eventBufferRef.current;
        eventBufferRef.current = [];
        for (const e of batch) dispatch(e);
      }, 0);
    },
    // `dispatch` from useReducer is stable for the component's lifetime.
    [],
  );

  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== undefined) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fileLogEnabledRef.current = fileLogEnabled;
  }, [fileLogEnabled]);

  const wrappedDispatch = useCallback(
    (event: ReplayEvent) => {
      switch (event.type) {
        case "run_start":
          stationIdRef.current = event.stationId;
          currentFileRef.current = event.file;
          break;
        case "session_start":
          sessionLogBufferRef.current = [];
          sessionMetaRef.current = {
            stationId: stationIdRef.current,
            file: currentFileRef.current,
            sessionIndex: event.sessionIndex,
            connectorId: event.connectorId,
            idTag: event.idTag,
          };
          break;
        case "log":
          sessionLogBufferRef.current.push({
            ts: event.ts,
            level: event.level,
            message: event.message,
          });
          break;
        case "session_done":
        case "session_rejected":
        case "session_truncated":
          if (fileLogEnabledRef.current && sessionMetaRef.current) {
            const endStatus =
              event.type === "session_done"
                ? "done"
                : event.type === "session_rejected"
                  ? "rejected"
                  : "truncated";
            const written = writeSessionLog(
              logDir,
              sessionMetaRef.current,
              endStatus,
              sessionLogBufferRef.current,
            );
            if (written) {
              enqueue({
                type: "log",
                ts: new Date().toISOString(),
                level: "info",
                message: `session log written ${written}`,
              });
            }
          }
          break;
      }
      enqueue(event);
    },
    [logDir, enqueue],
  );

  useEffect(() => {
    if (onReadyCalled.current) return;
    onReadyCalled.current = true;
    onReady({
      dispatch: wrappedDispatch,
      setFileStatuses: setFiles,
      setCurrentFileIndex: setCurrentIndex,
      showSummary: () => {
        setFinished(true);
        setAppPhase("complete");
      },
      controller: controllerRef.current,
    });
  }, [onReady, wrappedDispatch]);

  useEffect(() => {
    if (autoBegin && initialFiles.length > 0 && !autoBeginFired.current) {
      autoBeginFired.current = true;
      onBegin?.(
        initialFiles.map((f) => f.path),
        initialIdTag || undefined,
      );
    }
  }, [autoBegin, initialFiles, initialIdTag, onBegin]);

  // NOTE: appPhase is intentionally NOT slaved to state.phase. In a batch run
  // state.phase oscillates running → complete → running → complete … (once
  // per file), and mirroring that into appPhase used to leave the app stuck
  // at "complete" after the first file, killing all running-phase hotkeys.
  // appPhase only flips to "complete" via the batch driver's ctrl.showSummary().

  useEffect(() => {
    // When raw-mode isn't available (piped output, non-TTY), there's no way
    // for the user to press q — auto-exit shortly so the runner unblocks.
    // Otherwise, hold the summary screen open until the user dismisses it.
    if (finished && isRawModeSupported !== true) {
      const t = setTimeout(() => exit(), 100);
      return () => clearTimeout(t);
    }
    // The elapsed-time clock is only rendered during a running batch, so
    // don't tick (and force a tree re-render) during selecting/ready/complete.
    if (appPhase !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [finished, exit, appPhase, isRawModeSupported]);

  const startRun = (selectedPaths: string[]) => {
    if (selectedPaths.length === 0) return;
    const newFiles: FileStatus[] = selectedPaths.map((path) => ({
      path,
      status: "pending",
    }));
    setFiles(newFiles);
    setCurrentIndex(0);
    setAppPhase("running");
    onBegin?.(selectedPaths, idTag.trim() || undefined);
  };

  const loadConvertTask = (task: ConvertTask) => {
    const entries = readRawLogEntries(task.sourcePath);
    if (!entries) {
      setConvertParsed(undefined);
      setConvertError("could not parse raw log");
      return;
    }
    const parsed = parseRawLog(entries);
    setConvertParsed(parsed);
    setConvertError(
      parsed.sessionCount === 0 ? "no replayable sessions found" : undefined,
    );
  };

  const resetConvertState = () => {
    setConvertQueue([]);
    setConvertIndex(0);
    setConvertParsed(undefined);
    setConvertError(undefined);
    setPendingPaths([]);
  };

  const beginRun = (selectedPaths: string[]) => {
    if (selectedPaths.length === 0) return;
    const queue = buildConvertQueue(selectedPaths);
    if (queue.length === 0) {
      startRun(selectedPaths);
      return;
    }
    // Remember the picks so esc can restore them in the selection screen.
    // This seeds `files` only so the picker can show the count on esc; the
    // authoritative run queue lives in `pendingPaths` (path swaps update that),
    // and startRun overwrites `files` with the final converted set.
    const picked: FileStatus[] = selectedPaths.map((path) => ({
      path,
      status: "pending",
    }));
    setFiles(picked);
    setPendingPaths(selectedPaths);
    setConvertQueue(queue);
    setConvertIndex(0);
    setConvertMode("run");
    loadConvertTask(queue[0]);
    setAppPhase("converting");
  };

  // Convert-only ("v"): convert the raw logs in the selection, then return to
  // the selection screen with the outputs selected — never runs. No-op when
  // the selection holds no raw logs.
  const convertOnly = (selectedPaths: string[]) => {
    if (selectedPaths.length === 0) return;
    const queue = buildConvertQueue(selectedPaths);
    if (queue.length === 0) return;
    setFiles(selectedPaths.map((path) => ({ path, status: "pending" })));
    setPendingPaths(selectedPaths);
    setConvertQueue(queue);
    setConvertIndex(0);
    setConvertMode("select");
    loadConvertTask(queue[0]);
    setAppPhase("converting");
  };

  // Re-enter the selection screen with `paths` selected, remounting the browser
  // so newly written scenario files appear and the selection re-seeds.
  const returnToSelection = (paths: string[]) => {
    setFiles(paths.map((path) => ({ path, status: "pending" })));
    setPickerCount(paths.length);
    setBrowserNonce((n) => n + 1);
    setAppPhase("selecting");
  };

  const advanceConvert = (nextPaths: string[]) => {
    const next = convertIndex + 1;
    if (next < convertQueue.length) {
      setPendingPaths(nextPaths);
      setConvertIndex(next);
      loadConvertTask(convertQueue[next]);
      return;
    }
    resetConvertState();
    if (convertMode === "select") {
      returnToSelection(nextPaths);
      return;
    }
    if (nextPaths.length === 0) {
      setAppPhase("selecting");
      return;
    }
    startRun(nextPaths);
  };

  const handleConvertAccept = (values: {
    stationId: string;
    password: string;
    rebaseTimestamps: boolean;
  }) => {
    const task = convertQueue[convertIndex];
    if (!task || !convertParsed) return;
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
      setConvertError(
        `write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleConvertSkip = () => {
    const task = convertQueue[convertIndex];
    if (!task) return;
    advanceConvert(pendingPaths.filter((p) => p !== task.sourcePath));
  };

  const handleConvertCancel = () => {
    // In convert-only mode, keep any files already written (pendingPaths holds
    // the accumulated raw→output swaps) selected on return.
    const mode = convertMode;
    const paths = pendingPaths;
    resetConvertState();
    if (mode === "select") {
      returnToSelection(paths);
      return;
    }
    setAppPhase("selecting");
  };

  useInput(
    (input, key) => {
      // Modal text input for the idTag override field.
      if (editingIdTag) {
        if (key.escape) {
          setIdTagDraft(idTag);
          setEditingIdTag(false);
        } else if (key.return) {
          setIdTag(idTagDraft);
          setEditingIdTag(false);
        } else if (key.backspace || key.delete) {
          setIdTagDraft((d) => d.slice(0, -1));
        } else if (input && input.length > 0 && !key.ctrl && !key.meta) {
          setIdTagDraft((d) => d + input);
        }
        return;
      }

      // "t" opens the idTag input on the pre-run screens.
      if ((appPhase === "selecting" || appPhase === "ready") && input === "t") {
        setIdTagDraft(idTag);
        setEditingIdTag(true);
        return;
      }

      if (appPhase === "ready") {
        if (input === "B" || input === "b") {
          beginRun(files.map((f) => f.path));
        } else if (input === "e") {
          setAppPhase("selecting");
        } else if (input === "q") {
          exit();
        }
        return;
      }
      if (appPhase === "running") {
        const c = controllerRef.current;
        if (input === "p") {
          c.togglePause();
          setPaused(c.paused);
        } else if (input === "s") {
          c.requestStop();
        } else if (input === "a") {
          c.requestAbort();
        } else if (input === "l" || input === "L") {
          setFileLogEnabled((v) => !v);
        } else if (input === "?") {
          setShowHelp((v) => !v);
        }
        return;
      }
      if (appPhase === "complete") {
        if (input === "q" || key.return) {
          onRoundChoice?.("quit");
          exit();
        } else if (input === "f") {
          // New round: clear per-run state; keep the idTag override and the file-log preference.
          controllerRef.current.reset();
          setPaused(false);
          setShowHelp(false);
          setFinished(false);
          setFiles([]);
          setCurrentIndex(0);
          setPickerCount(0);
          setAppPhase("selecting");
          onRoundChoice?.("again");
        }
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const startMs = state.startedAt ? Date.parse(state.startedAt) : now;
  const elapsedMs = Math.max(0, now - startMs);
  const elapsed = fmtDuration(elapsedMs);
  const idTagNode = (
    <IdTagInput value={idTag} draft={idTagDraft} editing={editingIdTag} />
  );

  if (appPhase === "selecting") {
    const browserH = Math.max(3, innerH - 5);
    const title = (
      <Text wrap="truncate-end">
        <Text bold color={color.accent}>
          SELECT FILES
        </Text>
        <Text dimColor>{`  ${browserCwd}`}</Text>
      </Text>
    );
    return (
      <Frame
        width={cols}
        height={rows}
        title={title}
        right={`${pickerCount} selected`}
      >
        {idTagNode}
        <Rule width={innerW} />
        <FileBrowser
          key={browserNonce}
          initialCwd={browserCwd}
          initialSelected={files.map((f) => f.path)}
          disabled={editingIdTag}
          width={innerW}
          height={browserH}
          onBegin={beginRun}
          onConvert={convertOnly}
          onQuit={() => exit()}
          onSelectionChange={setPickerCount}
          onCwdChange={setBrowserCwd}
        />
        <Rule width={innerW} />
        <HelpBar phase="selecting" canBegin={pickerCount > 0} />
      </Frame>
    );
  }

  if (appPhase === "converting") {
    const task = convertQueue[convertIndex];
    const title = (
      <Text wrap="truncate-end">
        <Text bold color={color.accent}>
          CONVERT
        </Text>
        <Text dimColor>{`  ${task ? basename(task.sourcePath) : ""}`}</Text>
      </Text>
    );
    return (
      <Frame width={cols} height={rows} title={title}>
        {task ? (
          <ConvertWizard
            key={task.sourcePath}
            fileLabel={basename(task.sourcePath)}
            index={convertIndex}
            total={convertQueue.length}
            initialStationId={task.defaultStationId}
            stats={
              convertParsed
                ? {
                    calls: convertParsed.stats.keptCalls,
                    sessions: convertParsed.sessionCount,
                    dropped: convertParsed.stats.droppedFrames,
                    corrupt: convertParsed.stats.corruptEntries,
                  }
                : undefined
            }
            error={convertError}
            width={innerW}
            onAccept={handleConvertAccept}
            onSkip={handleConvertSkip}
            onCancel={handleConvertCancel}
          />
        ) : null}
      </Frame>
    );
  }

  if (appPhase === "ready") {
    const listH = Math.max(2, innerH - 4);
    const title = (
      <Text wrap="truncate-end">
        <Text bold color={color.accent}>
          READY
        </Text>
        <Text
          dimColor
        >{`  ${endpoint} · ${files.length} file${files.length === 1 ? "" : "s"}`}</Text>
      </Text>
    );
    return (
      <Frame width={cols} height={rows} title={title}>
        {idTagNode}
        <Rule width={innerW} />
        <Box flexDirection="column" height={listH}>
          <Text bold>Files ({files.length})</Text>
          <FileQueue
            files={files}
            currentIndex={-1}
            rows={listH - 1}
            width={innerW}
          />
        </Box>
        <HelpBar phase="ready" canBegin={files.length > 0} />
      </Frame>
    );
  }

  if (appPhase === "complete") {
    // title(1) + body + rule(1) + helpbar(1) = innerH
    const bodyH = Math.max(5, innerH - 3);
    const title = (
      <Text wrap="truncate-end">
        <Text bold color={color.accent}>
          COMPLETE
        </Text>
        <Text dimColor>{`  ${endpoint}`}</Text>
      </Text>
    );
    return (
      <Frame width={cols} height={rows} title={title} right={elapsed}>
        <SummaryScreen
          fileResults={state.fileResults}
          files={files}
          width={innerW}
          height={bodyH}
          interactive={isRawModeSupported === true}
        />
        <Rule width={innerW} />
        <HelpBar phase="complete" />
      </Frame>
    );
  }

  // ---- running dashboard ----
  const body = Math.max(3, innerH - 5 - (showHelp ? HELP_ROWS : 0));
  const fileBase = state.file ? basename(state.file) : "(loading)";
  const action =
    state.phase === "running"
      ? state.currentAction
        ? `${icon.send} ${state.currentAction}`
        : `${icon.send} working`
      : state.phase === "aborting"
        ? "aborting"
        : state.phase === "complete"
          ? "complete"
          : "idle";

  const tally = (
    <Text>
      <Text bold>SESSIONS</Text>
      <Text> </Text>
      <Text color={color.success}>
        {icon.done}
        {state.successfulStarts}
      </Text>{" "}
      <Text color={color.error}>
        {icon.rejected}
        {state.rejected}
      </Text>{" "}
      <Text color={color.warn}>
        {icon.truncated}
        {state.truncated}
      </Text>
    </Text>
  );

  const wide = innerW >= NARROW_COLS;
  const leftW = Math.max(24, Math.min(Math.floor(innerW * 0.5), 52));
  const rightW = Math.max(12, innerW - leftW - 1);

  const title = (
    <Text wrap="truncate-end">
      <Text bold color={color.accent}>
        REPLAY
      </Text>
      <Text dimColor>{`  ${state.stationId ?? "—"} · ${fileBase}`}</Text>
      {files.length > 1 ? (
        <Text dimColor>{` · file ${currentIndex + 1}/${files.length}`}</Text>
      ) : null}
    </Text>
  );
  const right = (
    <Box flexShrink={0}>
      <FileDots files={files} currentIndex={currentIndex} />
      <Text dimColor>
        {files.length > 1 ? "  " : ""}
        {elapsed}
      </Text>
    </Box>
  );

  return (
    <Frame width={cols} height={rows} title={title} right={right}>
      <ProgressStrip state={state} width={innerW} />
      <Rule width={innerW} />
      {wide ? (
        <Box height={body}>
          <Box
            flexDirection="column"
            width={leftW}
            borderStyle="single"
            borderColor={color.chrome}
            borderTop={false}
            borderBottom={false}
            borderLeft={false}
            borderRight={true}
            paddingRight={1}
          >
            {tally}
            <SessionList
              sessions={state.sessions}
              rows={body - 1}
              width={leftW - 2}
            />
          </Box>
          <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
            <Text bold>LOG</Text>
            <LogTail logs={state.logs} rows={body - 1} width={rightW} />
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" height={body}>
          {tally}
          <SessionList
            sessions={state.sessions}
            rows={Math.max(1, Math.floor((body - 2) / 2))}
            width={innerW}
          />
          <Text bold>LOG</Text>
          <LogTail
            logs={state.logs}
            rows={Math.max(1, body - 2 - Math.floor((body - 2) / 2))}
            width={innerW}
          />
        </Box>
      )}
      {showHelp ? <HelpDetails width={innerW} /> : null}
      <Rule width={innerW} />
      <Box justifyContent="space-between">
        <Box flexShrink={1}>
          <Text wrap="truncate-end">
            <Text color={color.accent}>{action}</Text>
            <Text dimColor>{`   ${shortKeys("running", false)}`}</Text>
          </Text>
        </Box>
        <Box flexShrink={0}>
          {paused ? <Text color={color.warn}> paused</Text> : null}
          {fileLogEnabled ? (
            <Text color={color.error}> {icon.rec} REC</Text>
          ) : null}
        </Box>
      </Box>
    </Frame>
  );
}
