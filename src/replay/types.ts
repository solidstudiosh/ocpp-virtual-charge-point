export interface ReplayMessage {
  id: string;
  timestamp: string;
  action: string;
  messageType: string;
  messageId: string;
  idTag: string;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
  body: any;
}

export interface ReplaySession {
  connectorId: string;
  startSignal: { kind: string; timestamp: string };
  endSignal: { kind: string; timestamp: string };
  idTag: string;
  windowStart: string;
  windowEnd: string;
  messages: ReplayMessage[];
}

export interface ReplayFile {
  stationId: string;
  /** Optional per-file basic-auth password; falls back to env PASSWORD. */
  password?: string;
  sessions: ReplaySession[];
}

export interface SessionContext {
  connectorId: number;
  idTag: string;
  idTagOverride?: string;
  capturedTxId?: number;
  meterStartWh?: number;
  lastEnergyWh?: number;
}

export type RejectionReason =
  | "call_error"
  | "id_tag_not_accepted"
  | "timeout"
  | "schema_invalid"
  | "missing_transaction_id"
  | "unknown_action"
  | "synthetic_stop_failed";

export interface RejectionRecord {
  ts: string;
  stationId: string;
  connectorId: string;
  windowStart: string;
  windowEnd: string;
  idTag: string;
  failedAt: { action: string; messageIndex: number };
  reason: RejectionReason;
  // biome-ignore lint/suspicious/noExplicitAny: free-form details
  details: any;
}

export interface RunSummary {
  ts: string;
  stationId: string;
  sessionsTotal: number;
  sessionsSucceeded: number;
  sessionsRejected: number;
  sessionsTruncated: number;
  durationMs: number;
  durationIso: string;
  exitCode: number;
}
