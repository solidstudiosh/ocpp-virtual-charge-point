import { readFileSync } from "node:fs";
import type { ReplayFile, ReplaySession } from "./types";

export const ALLOWED_REPLAY_ACTIONS = new Set([
  "BootNotification",
  "StatusNotification",
  "Authorize",
  "StartTransaction",
  "MeterValues",
  "StopTransaction",
  "Heartbeat",
]);

export interface PlanOptions {
  /** Apply MeterValues downsampling (stride 2 or 4 above 100/200). Default false (opt-in). */
  downsampleMeterValues?: boolean;
}

/**
 * Counts how many CALL frames the runner will actually emit for a session,
 * mirroring the filters in replayRunner.ts (allowed actions, MV downsampling)
 * plus the synthetic StopTransaction the runner appends on a normal end.
 */
export function countPlannedMessages(
  session: ReplaySession,
  opts: PlanOptions = {},
): number {
  const downsample = opts.downsampleMeterValues === true;
  let sendable = 0;
  let hasRecordedStop = false;
  const mvPositions: number[] = [];
  for (let i = 0; i < session.messages.length; i++) {
    const m = session.messages[i];
    if (m.messageType !== "2") continue;
    if (!ALLOWED_REPLAY_ACTIONS.has(m.action)) continue;
    if (m.action === "MeterValues") mvPositions.push(sendable);
    if (m.action === "StopTransaction") hasRecordedStop = true;
    sendable++;
  }
  const mvTotal = mvPositions.length;
  const stride = downsample ? (mvTotal > 200 ? 4 : mvTotal > 100 ? 2 : 1) : 1;
  let skipped = 0;
  if (stride > 1 && mvTotal > 0) {
    const keep = new Set<number>();
    keep.add(0);
    keep.add(mvTotal - 1);
    for (let pos = 0; pos < mvTotal; pos += stride) keep.add(pos);
    skipped = mvTotal - keep.size;
  }
  // +1 for the synthetic StopTransaction the runner appends — but only when
  // the recording has no Stop of its own, otherwise the recorded one is sent.
  return Math.max(0, sendable - skipped) + (hasRecordedStop ? 0 : 1);
}

export interface BatchTotals {
  files: number;
  sessions: number;
  messages: number;
}

export function precomputeBatchTotals(
  files: string[],
  opts: PlanOptions = {},
): BatchTotals {
  let sessions = 0;
  let messages = 0;
  for (const path of files) {
    let parsed: ReplayFile;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue;
    }
    if (!Array.isArray(parsed.sessions)) continue;
    sessions += parsed.sessions.length;
    for (const s of parsed.sessions) messages += countPlannedMessages(s, opts);
  }
  return { files: files.length, sessions, messages };
}
