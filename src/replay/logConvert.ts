import { ALLOWED_REPLAY_ACTIONS } from "./plan";
import type { ReplayFile, ReplayMessage, ReplaySession } from "./types";

export interface RawLogEntry {
  timestamp: string;
  payload: string;
}

/** One CALL frame from the raw log, in chronological position. */
export interface RawFrame {
  /** Envelope (log) time in epoch ms; undefined when unparseable. */
  envelopeMs: number | undefined;
  /** Envelope time normalized to UTC ISO with ms; verbatim if unparseable. */
  envelopeIso: string;
  action: string;
  messageId: string;
  // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
  body: any;
  /** False for frames the scenario format excludes (responses are not even
   * retained; this marks disallowed actions kept only as idTag donors). */
  kept: boolean;
}

export interface ParseStats {
  totalEntries: number;
  keptCalls: number;
  /** Responses (messageType 3/4) plus disallowed-action calls. */
  droppedFrames: number;
  /** Unparseable payloads / malformed frames. */
  corruptEntries: number;
}

export interface ParsedRawLog {
  /** Chronological (oldest first), kept and unkept calls interleaved. */
  frames: RawFrame[];
  stats: ParseStats;
  /** Number of sessions splitting will produce (rebase-independent). */
  sessionCount: number;
}

export function isRawOcppLog(parsed: unknown): parsed is RawLogEntry[] {
  return (
    Array.isArray(parsed) &&
    parsed.length > 0 &&
    parsed.every(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as RawLogEntry).timestamp === "string" &&
        typeof (e as RawLogEntry).payload === "string",
    )
  );
}

export function parseRawLog(entries: RawLogEntry[]): ParsedRawLog {
  const frames: RawFrame[] = [];
  let droppedFrames = 0;
  let corruptEntries = 0;
  // The export is newest-first; reverse so stable sorting preserves the
  // original intra-second order.
  for (const entry of [...entries].reverse()) {
    let frame: unknown;
    try {
      frame = JSON.parse(entry.payload);
    } catch {
      corruptEntries++;
      continue;
    }
    if (!Array.isArray(frame) || typeof frame[0] !== "number") {
      corruptEntries++;
      continue;
    }
    if (frame[0] !== 2) {
      droppedFrames++;
      continue;
    }
    const [, messageId, action, body] = frame;
    if (typeof messageId !== "string" || typeof action !== "string") {
      corruptEntries++;
      continue;
    }
    const kept = ALLOWED_REPLAY_ACTIONS.has(action);
    if (!kept) droppedFrames++;
    const ms = Date.parse(entry.timestamp);
    frames.push({
      envelopeMs: Number.isNaN(ms) ? undefined : ms,
      envelopeIso: Number.isNaN(ms)
        ? entry.timestamp
        : new Date(ms).toISOString(),
      action,
      messageId,
      body: body ?? {},
      kept,
    });
  }
  // Stable sort; frames without a parseable envelope stay where log order
  // put them relative to their neighbours.
  frames.sort((a, b) => {
    if (a.envelopeMs === undefined || b.envelopeMs === undefined) return 0;
    return a.envelopeMs - b.envelopeMs;
  });
  return {
    frames,
    stats: {
      totalEntries: entries.length,
      keptCalls: frames.filter((f) => f.kept).length,
      droppedFrames,
      corruptEntries,
    },
    sessionCount: countSessions(frames),
  };
}

/** Cuts the chronological stream after each kept StopTransaction. */
function splitPartitions(frames: RawFrame[]): RawFrame[][] {
  const parts: RawFrame[][] = [];
  let current: RawFrame[] = [];
  for (const f of frames) {
    current.push(f);
    if (f.kept && f.action === "StopTransaction") {
      parts.push(current);
      current = [];
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

function countSessions(frames: RawFrame[]): number {
  return splitPartitions(frames).filter((p) =>
    p.some((f) => f.kept && f.action === "StartTransaction"),
  ).length;
}

function resolveIdTag(start: RawFrame, partition: RawFrame[]): string {
  const own = start.body?.idTag;
  if (typeof own === "string" && own) return own;
  for (const f of partition) {
    const t = f.body?.idTag ?? f.body?.idToken?.idToken;
    if (typeof t === "string" && t) return t;
  }
  return "";
}

export interface BuildOptions {
  stationId: string;
  password?: string;
  rebaseTimestamps: boolean;
  /** Injected conversion moment — the rebase anchor target. */
  now: Date;
}

export function buildReplayFile(
  parsed: ParsedRawLog,
  opts: BuildOptions,
): ReplayFile {
  const frames = opts.rebaseTimestamps
    ? rebaseFrames(parsed.frames, opts.now)
    : parsed.frames;
  const sessions: ReplaySession[] = [];
  let nextId = 1;
  const toMessage = (f: RawFrame): ReplayMessage => ({
    id: String(nextId++),
    timestamp: f.envelopeIso,
    action: f.action,
    messageType: "2",
    messageId: f.messageId,
    idTag: typeof f.body?.idTag === "string" ? f.body.idTag : "",
    body: f.body,
  });
  for (const partition of splitPartitions(frames)) {
    const start = partition.find(
      (f) => f.kept && f.action === "StartTransaction",
    );
    if (!start) {
      // A startless partition is the run of kept frames trailing the last
      // StopTransaction (e.g. the connector returning to Available). Append
      // them to the session they followed instead of discarding them; the
      // session's end stays anchored on its StopTransaction. With no prior
      // session there is nothing to attach to, so the frames are dropped.
      const prev = sessions[sessions.length - 1];
      if (prev) {
        for (const f of partition) if (f.kept) prev.messages.push(toMessage(f));
      }
      continue;
    }
    const kept = partition.filter((f) => f.kept);
    const first = kept[0];
    const last = kept[kept.length - 1];
    // splitPartitions cuts right after a Stop, so when present it is `last`.
    const hasStop = last.action === "StopTransaction";
    const messages: ReplayMessage[] = kept.map(toMessage);
    const startKind =
      first.action === "StatusNotification" &&
      typeof first.body?.status === "string"
        ? first.body.status
        : "StartTransaction";
    sessions.push({
      connectorId: String(start.body?.connectorId ?? ""),
      startSignal: { kind: startKind, timestamp: first.envelopeIso },
      endSignal: {
        kind: hasStop ? "StopTransaction" : "EndOfData",
        timestamp: last.envelopeIso,
      },
      idTag: resolveIdTag(start, partition),
      windowStart: first.envelopeIso,
      windowEnd: last.envelopeIso,
      messages,
    });
  }
  const file: ReplayFile = { stationId: opts.stationId, sessions };
  if (opts.password) file.password = opts.password;
  return file;
}

/** Body timestamps older than this are treated as broken and left verbatim. */
const MIN_VALID_MS = Date.UTC(2000, 0, 1);

function shiftIso(value: unknown, deltaMs: number): unknown {
  if (typeof value !== "string") return value;
  const ms = Date.parse(value);
  if (Number.isNaN(ms) || ms < MIN_VALID_MS) return value;
  return new Date(ms + deltaMs).toISOString();
}

// biome-ignore lint/suspicious/noExplicitAny: ocpp payload
function rebaseBody(body: any, deltaMs: number): any {
  if (body === null || typeof body !== "object") return body;
  const out = { ...body };
  if ("timestamp" in out) out.timestamp = shiftIso(out.timestamp, deltaMs);
  if (Array.isArray(out.meterValue)) {
    // biome-ignore lint/suspicious/noExplicitAny: ocpp payload
    out.meterValue = out.meterValue.map((mv: any) =>
      mv && typeof mv === "object"
        ? { ...mv, timestamp: shiftIso(mv.timestamp, deltaMs) }
        : mv,
    );
  }
  return out;
}

/**
 * Shifts the whole timeline by one delta so the last StopTransaction's
 * envelope lands at `now` (no Stop → the last datable kept frame). Frames
 * whose envelope didn't parse are excluded from the math and left verbatim.
 */
function rebaseFrames(frames: RawFrame[], now: Date): RawFrame[] {
  const datable = frames.filter((f) => f.kept && f.envelopeMs !== undefined);
  const anchor =
    [...datable].reverse().find((f) => f.action === "StopTransaction") ??
    datable[datable.length - 1];
  if (!anchor || anchor.envelopeMs === undefined) return frames;
  const deltaMs = now.getTime() - anchor.envelopeMs;
  return frames.map((f) => {
    if (f.envelopeMs === undefined) return f;
    const shiftedMs = f.envelopeMs + deltaMs;
    return {
      ...f,
      envelopeMs: shiftedMs,
      envelopeIso: new Date(shiftedMs).toISOString(),
      body: rebaseBody(f.body, deltaMs),
    };
  });
}
