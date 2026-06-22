import type { ReplayEvent } from "../events";
import type { RejectionReason, RunSummary } from "../types";

export type SessionStatus =
  | "pending"
  | "running"
  | "done"
  | "rejected"
  | "truncated";

export interface SessionRow {
  index: number;
  connectorId?: string;
  idTag?: string;
  txId?: number;
  windowStart?: string;
  status: SessionStatus;
  reason?: RejectionReason;
  failedAt?: { action: string; messageIndex: number };
  startAccepted?: boolean;
}

export interface LogEntry {
  ts: string;
  level: string;
  message: string;
}

export interface LogLine extends LogEntry {
  id: number;
}

/** One finished file's results, archived so a batch summary can show them. */
export interface FileResult {
  file: string;
  stationId?: string;
  summary?: RunSummary;
  sessions: SessionRow[];
}

let nextLogId = 0;

export interface TuiState {
  phase: "idle" | "running" | "aborting" | "complete";
  stationId?: string;
  file?: string;
  startedAt?: string;
  sessions: SessionRow[];
  currentSessionIndex?: number;
  currentAction?: string;
  /** Messages sent in the current file (resets on run_start). */
  messagesSent: number;
  /** Sessions counted as done/rejected/truncated in the current file. */
  succeeded: number;
  rejected: number;
  truncated: number;
  /** "Start accepted" counter: ++ on Accepted, -- on session error. */
  successfulStarts: number;
  /** Batch totals (set by batch_start). */
  batchTotalFiles: number;
  batchTotalSessions: number;
  batchTotalMessages: number;
  /** Batch running tallies (accumulate across files). */
  batchSessionsDone: number;
  batchMessagesSent: number;
  /** Current session counters. */
  currentSessionMessagesPlanned?: number;
  currentSessionMessagesSent: number;
  logs: LogLine[];
  /** Per-file results archived on run_complete; cleared on batch_start. */
  fileResults: FileResult[];
  summary?: RunSummary;
}

const MAX_LOGS = 50;

export const initialState: TuiState = {
  phase: "idle",
  sessions: [],
  messagesSent: 0,
  succeeded: 0,
  rejected: 0,
  truncated: 0,
  successfulStarts: 0,
  batchTotalFiles: 0,
  batchTotalSessions: 0,
  batchTotalMessages: 0,
  batchSessionsDone: 0,
  batchMessagesSent: 0,
  currentSessionMessagesSent: 0,
  logs: [],
  fileResults: [],
};

export function reduce(state: TuiState, event: ReplayEvent): TuiState {
  switch (event.type) {
    case "batch_start":
      return {
        ...state,
        batchTotalFiles: event.totalFiles,
        batchTotalSessions: event.totalSessions,
        batchTotalMessages: event.totalMessages,
        batchSessionsDone: 0,
        batchMessagesSent: 0,
        successfulStarts: 0,
        startedAt: undefined,
        fileResults: [],
      };
    case "run_start":
      return {
        ...state,
        phase: "running",
        stationId: event.stationId,
        file: event.file,
        startedAt: state.startedAt ?? event.ts,
        sessions: Array.from({ length: event.totalSessions }, (_, i) => ({
          index: i,
          status: "pending" as SessionStatus,
        })),
        messagesSent: 0,
        succeeded: 0,
        rejected: 0,
        truncated: 0,
        successfulStarts: 0,
        currentSessionMessagesPlanned: undefined,
        currentSessionMessagesSent: 0,
        summary: undefined,
      };
    case "bootstrap_done":
      return state;
    case "session_start": {
      const sessions = state.sessions.slice();
      sessions[event.sessionIndex] = {
        ...(sessions[event.sessionIndex] ?? { index: event.sessionIndex }),
        index: event.sessionIndex,
        connectorId: event.connectorId,
        idTag: event.idTag,
        windowStart: event.windowStart,
        status: "running",
        startAccepted: false,
      };
      return {
        ...state,
        sessions,
        currentSessionIndex: event.sessionIndex,
        currentAction: undefined,
        currentSessionMessagesPlanned: event.messagesPlanned,
        currentSessionMessagesSent: 0,
      };
    }
    case "message_send":
      return {
        ...state,
        currentAction: event.action,
        messagesSent: state.messagesSent + 1,
        batchMessagesSent: state.batchMessagesSent + 1,
        currentSessionMessagesSent: state.currentSessionMessagesSent + 1,
      };
    case "start_accepted": {
      const sessions = state.sessions.slice();
      const prev = sessions[event.sessionIndex];
      if (prev) {
        sessions[event.sessionIndex] = {
          ...prev,
          startAccepted: true,
          txId: event.transactionId ?? prev.txId,
        };
      }
      return {
        ...state,
        sessions,
        successfulStarts: state.successfulStarts + 1,
      };
    }
    case "session_done": {
      const sessions = state.sessions.slice();
      sessions[event.sessionIndex] = {
        ...sessions[event.sessionIndex],
        status: "done",
      };
      return {
        ...state,
        sessions,
        succeeded: state.succeeded + 1,
        batchSessionsDone: state.batchSessionsDone + 1,
        currentAction: undefined,
      };
    }
    case "session_rejected": {
      const sessions = state.sessions.slice();
      const prev = sessions[event.sessionIndex];
      const hadAccepted = prev?.startAccepted === true;
      sessions[event.sessionIndex] = {
        ...prev,
        status: "rejected",
        reason: event.reason,
        failedAt: event.failedAt,
      };
      return {
        ...state,
        sessions,
        rejected: state.rejected + 1,
        batchSessionsDone: state.batchSessionsDone + 1,
        successfulStarts: hadAccepted
          ? Math.max(0, state.successfulStarts - 1)
          : state.successfulStarts,
        currentAction: undefined,
      };
    }
    case "session_truncated": {
      const sessions = state.sessions.slice();
      sessions[event.sessionIndex] = {
        ...sessions[event.sessionIndex],
        status: "truncated",
      };
      return {
        ...state,
        sessions,
        truncated: state.truncated + 1,
        batchSessionsDone: state.batchSessionsDone + 1,
        currentAction: undefined,
      };
    }
    case "run_aborted":
      return { ...state, phase: "aborting" };
    case "run_complete":
      return {
        ...state,
        phase: "complete",
        summary: event.summary,
        fileResults: state.fileResults.concat({
          file: state.file ?? "",
          stationId: state.stationId,
          summary: event.summary,
          sessions: state.sessions,
        }),
      };
    case "log": {
      const next = state.logs.concat({
        id: nextLogId++,
        ts: event.ts,
        level: event.level,
        message: event.message,
      });
      const trimmed =
        next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
      return { ...state, logs: trimmed };
    }
  }
}
