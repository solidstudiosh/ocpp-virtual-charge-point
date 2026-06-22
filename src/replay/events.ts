import type { RejectionReason, RunSummary } from "./types";

export type ReplayEvent =
  | {
      type: "batch_start";
      ts: string;
      totalFiles: number;
      totalSessions: number;
      totalMessages: number;
    }
  | {
      type: "run_start";
      ts: string;
      stationId: string;
      file: string;
      totalSessions: number;
    }
  | {
      type: "bootstrap_done";
      ts: string;
    }
  | {
      type: "session_start";
      ts: string;
      sessionIndex: number;
      connectorId: string;
      idTag: string;
      windowStart: string;
      messagesPlanned?: number;
    }
  | {
      type: "message_send";
      ts: string;
      sessionIndex: number;
      messageIndex: number;
      action: string;
    }
  | {
      type: "start_accepted";
      ts: string;
      sessionIndex: number;
      transactionId?: number;
    }
  | {
      type: "session_done";
      ts: string;
      sessionIndex: number;
    }
  | {
      type: "session_rejected";
      ts: string;
      sessionIndex: number;
      reason: RejectionReason;
      details: unknown;
      failedAt: { action: string; messageIndex: number };
    }
  | {
      type: "session_truncated";
      ts: string;
      sessionIndex: number;
    }
  | {
      type: "run_aborted";
      ts: string;
    }
  | {
      type: "run_complete";
      ts: string;
      summary: RunSummary;
    }
  | {
      type: "log";
      ts: string;
      level: string;
      message: string;
    };

export type ReplayEventEmitter = (event: ReplayEvent) => void;
