import { readFileSync } from "node:fs";
import { logger } from "../logger";
import { call as makeCall } from "../messageFactory";
import { OcppVersion } from "../ocppVersion";
import { VCP } from "../vcp";
import { resolveConnection } from "./connection";
import { ALLOWED_REPLAY_ACTIONS, countPlannedMessages } from "./plan";
import { replayMessageHandlerV16 } from "./replayMessageHandler";
import {
  applySubstitutions,
  extractEnergyWh,
  synthesizeStopTransaction,
} from "./substitution";
import { RejectionLog } from "./rejectionLog";
import { RunLog } from "./runLog";
import { Temporal } from "./temporalCompat";
import type { ReplayEvent, ReplayEventEmitter } from "./events";
import type { ReplayController } from "./controller";
import type {
  RejectionReason,
  RejectionRecord,
  ReplayFile,
  ReplayMessage,
  ReplaySession,
  RunSummary,
  SessionContext,
} from "./types";

const ALLOWED_ACTIONS = ALLOWED_REPLAY_ACTIONS;

function nowIso(): string {
  return new Date().toISOString();
}

function emit(
  onEvent: ReplayEventEmitter | undefined,
  event: ReplayEvent,
): void {
  if (!onEvent) return;
  try {
    onEvent(event);
  } catch {
    /* UI errors must not break the runner */
  }
}

export interface ReplayRunnerOptions {
  replayFile: string;
  endpoint: string;
  /** CLI `--cp-id` — forces the OCPP id, overriding the file's stationId. */
  cpIdForce?: string;
  /** Env `CP_ID` — fallback id used only when the file has no stationId. */
  cpIdDefault?: string;
  /** CLI `--password` — forces the basic-auth password. */
  passwordForce?: string;
  /** Env `PASSWORD` — fallback password used when the file has none. */
  passwordDefault?: string;
  idTagOverride?: string;
  rejectionsLogPath: string;
  runsLogPath: string;
  responseTimeoutMs: number;
  onEvent?: ReplayEventEmitter;
  controller?: ReplayController;
  /** Apply MeterValues downsampling (stride 2/4 above 100/200). Default false (opt-in). */
  downsampleMeterValues?: boolean;
}

interface SessionOutcome {
  succeeded: boolean;
  truncated?: boolean;
  rejection?: {
    reason: RejectionReason;
    failedAt: { action: string; messageIndex: number };
    details: unknown;
  };
}

interface SessionRunContext {
  sessionIndex: number;
  onEvent: ReplayEventEmitter | undefined;
  controller: ReplayController | undefined;
  downsampleMeterValues: boolean;
}

export interface ReplayRunResult {
  exitCode: number;
  summary: RunSummary;
  replayFile: string;
}

export async function runReplay(
  opts: ReplayRunnerOptions,
): Promise<ReplayRunResult> {
  const startInstant = Temporal.Now.instant();
  const file: ReplayFile = JSON.parse(readFileSync(opts.replayFile, "utf8"));
  const connection = resolveConnection(file, {
    cpIdForce: opts.cpIdForce,
    cpIdDefault: opts.cpIdDefault,
    passwordForce: opts.passwordForce,
    passwordDefault: opts.passwordDefault,
  });
  if (!connection.cpId) {
    logger.error(
      `replay aborted: no OCPP id — set stationId in ${opts.replayFile}, or pass --cp-id / CP_ID`,
    );
    const elapsed = Temporal.Now.instant().since(startInstant);
    const summary: RunSummary = {
      ts: new Date().toISOString(),
      stationId: "",
      sessionsTotal: 0,
      sessionsSucceeded: 0,
      sessionsRejected: 0,
      sessionsTruncated: 0,
      durationMs: elapsed.total({ unit: "milliseconds" }),
      durationIso: elapsed.toString(),
      exitCode: 3,
    };
    new RunLog(opts.runsLogPath).append(summary);
    return { exitCode: 3, summary, replayFile: opts.replayFile };
  }
  const stationId = connection.cpId;
  const rejectionLog = new RejectionLog(opts.rejectionsLogPath);
  const runLog = new RunLog(opts.runsLogPath);
  logger.info(
    `replay_started sid=${stationId} sessions=${file.sessions.length}${
      opts.idTagOverride ? ` idTagOverride=${opts.idTagOverride}` : ""
    }`,
  );
  emit(opts.onEvent, {
    type: "run_start",
    ts: nowIso(),
    stationId,
    file: opts.replayFile,
    totalSessions: file.sessions.length,
  });

  const vcp = new VCP({
    endpoint: opts.endpoint,
    chargePointId: stationId,
    ocppVersion: OcppVersion.OCPP_1_6,
    basicAuthPassword: connection.password,
    messageHandlerOverride: replayMessageHandlerV16,
  });

  let succeeded = 0;
  let rejected = 0;
  let truncated = 0;
  let exitCode = 0;

  try {
    await vcp.connect();
    const bootOk = await bootstrap(vcp, stationId, opts.responseTimeoutMs);
    if (!bootOk) {
      exitCode = 2;
    } else {
      emit(opts.onEvent, { type: "bootstrap_done", ts: nowIso() });
      let sessionIndex = 0;
      for (const session of file.sessions) {
        if (opts.controller?.abortRequested) break;
        const effectiveIdTag = opts.idTagOverride ?? session.idTag;
        logger.info(
          `session_start sid=${stationId} cid=${session.connectorId} idTag=${effectiveIdTag} windowStart=${session.windowStart}`,
        );
        emit(opts.onEvent, {
          type: "session_start",
          ts: nowIso(),
          sessionIndex,
          connectorId: session.connectorId,
          idTag: effectiveIdTag,
          windowStart: session.windowStart,
          messagesPlanned: countPlannedMessages(session, {
            downsampleMeterValues: opts.downsampleMeterValues,
          }),
        });
        const outcome = await runSession(
          vcp,
          session,
          opts.responseTimeoutMs,
          opts.idTagOverride,
          {
            sessionIndex,
            onEvent: opts.onEvent,
            controller: opts.controller,
            downsampleMeterValues: opts.downsampleMeterValues === true,
          },
        );
        if (outcome.truncated) {
          truncated++;
          logger.info(
            `session_truncated sid=${stationId} cid=${session.connectorId} sessionIndex=${sessionIndex}`,
          );
          emit(opts.onEvent, {
            type: "session_truncated",
            ts: nowIso(),
            sessionIndex,
          });
        } else if (outcome.succeeded) {
          succeeded++;
          logger.info(
            `session_done sid=${stationId} cid=${session.connectorId}`,
          );
          emit(opts.onEvent, {
            type: "session_done",
            ts: nowIso(),
            sessionIndex,
          });
        } else {
          rejected++;
          const rec: RejectionRecord = {
            ts: new Date().toISOString(),
            stationId,
            connectorId: session.connectorId,
            windowStart: session.windowStart,
            windowEnd: session.windowEnd,
            idTag: opts.idTagOverride ?? session.idTag,
            // biome-ignore lint/style/noNonNullAssertion: outcome.rejection set when !succeeded
            failedAt: outcome.rejection!.failedAt,
            // biome-ignore lint/style/noNonNullAssertion: same
            reason: outcome.rejection!.reason,
            // biome-ignore lint/style/noNonNullAssertion: same
            details: outcome.rejection!.details,
          };
          rejectionLog.append(rec);
          logger.warn(
            `session_rejected sid=${stationId} cid=${session.connectorId} reason=${rec.reason}`,
          );
          emit(opts.onEvent, {
            type: "session_rejected",
            ts: nowIso(),
            sessionIndex,
            reason: rec.reason,
            details: rec.details,
            failedAt: rec.failedAt,
          });
        }
        sessionIndex++;
      }
      if (opts.controller?.abortRequested) {
        logger.info(`run_aborted sid=${stationId}`);
        emit(opts.onEvent, { type: "run_aborted", ts: nowIso() });
        if (exitCode < 4) exitCode = 4;
      } else if (succeeded === 0 && rejected > 0) {
        exitCode = 1;
      }
    }
  } catch (err) {
    logger.error(
      `replay run aborted: ${err instanceof Error ? err.message : String(err)}`,
    );
    exitCode = 2;
  } finally {
    try {
      vcp.close();
    } catch {
      /* ignore */
    }
  }

  const elapsed = Temporal.Now.instant().since(startInstant);
  const durationMs = elapsed.total({ unit: "milliseconds" });
  const durationIso = elapsed.toString();
  const summary: RunSummary = {
    ts: new Date().toISOString(),
    stationId,
    sessionsTotal: succeeded + rejected + truncated,
    sessionsSucceeded: succeeded,
    sessionsRejected: rejected,
    sessionsTruncated: truncated,
    durationMs,
    durationIso,
    exitCode,
  };
  runLog.append(summary);
  logger.info(
    `replay_complete sid=${stationId} duration=${durationIso} durationMs=${durationMs.toFixed(3)} succeeded=${succeeded} rejected=${rejected} exitCode=${exitCode}`,
  );
  emit(opts.onEvent, { type: "run_complete", ts: nowIso(), summary });
  return { exitCode, summary, replayFile: opts.replayFile };
}

async function bootstrap(
  vcp: VCP,
  stationId: string,
  timeoutMs: number,
): Promise<boolean> {
  try {
    const bootRes = await vcp.sendAndAwait<{ status: string }>(
      makeCall("BootNotification", {
        chargePointVendor: "VCP-Replay",
        chargePointModel: "Replay",
        chargePointSerialNumber: stationId,
        firmwareVersion: "replay-1.0",
      }),
      { timeoutMs },
    );
    if (bootRes.status !== "Accepted") {
      logger.error(`BootNotification not accepted: ${bootRes.status}`);
      return false;
    }
    await vcp.sendAndAwait(
      makeCall("StatusNotification", {
        connectorId: 0,
        errorCode: "NoError",
        status: "Available",
      }),
      { timeoutMs },
    );
    return true;
  } catch (err) {
    logger.error(`bootstrap failed: ${JSON.stringify(err)}`);
    return false;
  }
}

function pickMeterValuesToSkip(session: ReplaySession): Set<number> {
  const mvIndices: number[] = [];
  for (let i = 0; i < session.messages.length; i++) {
    const m = session.messages[i];
    if (m.messageType === "2" && m.action === "MeterValues") mvIndices.push(i);
  }
  const stride = mvIndices.length > 200 ? 4 : mvIndices.length > 100 ? 2 : 1;
  if (stride === 1) return new Set();

  const keep = new Set<number>();
  // Mandatory: first and last MeterValues.
  keep.add(mvIndices[0]);
  keep.add(mvIndices[mvIndices.length - 1]);
  // Every stride-th in between (positions 0, stride, 2*stride, ...).
  for (let pos = 0; pos < mvIndices.length; pos += stride) {
    keep.add(mvIndices[pos]);
  }

  const skip = new Set<number>();
  for (const idx of mvIndices) if (!keep.has(idx)) skip.add(idx);
  return skip;
}

async function runSession(
  vcp: VCP,
  session: ReplaySession,
  timeoutMs: number,
  idTagOverride: string | undefined,
  runCtx: SessionRunContext,
): Promise<SessionOutcome> {
  const { sessionIndex, onEvent, controller } = runCtx;
  const ctx: SessionContext = {
    connectorId: Number(session.connectorId),
    idTag: idTagOverride ?? session.idTag,
    idTagOverride,
  };

  const skipMvIndices = runCtx.downsampleMeterValues
    ? pickMeterValuesToSkip(session)
    : new Set<number>();
  if (skipMvIndices.size > 0) {
    logger.info(
      `meter_values_downsampled sid=${session.connectorId} skipped=${skipMvIndices.size}`,
    );
  }

  let stoppedNow = false;
  let sentRecordedStop = false;
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    if (msg.messageType !== "2") continue;
    if (!ALLOWED_ACTIONS.has(msg.action)) {
      logger.warn(`skipping unknown action ${msg.action}`);
      continue;
    }
    if (skipMvIndices.has(i)) continue;

    if (controller) {
      await controller.waitWhilePaused();
      if (controller.consumeStop()) {
        stoppedNow = true;
        break;
      }
    }

    emit(onEvent, {
      type: "message_send",
      ts: nowIso(),
      sessionIndex,
      messageIndex: i,
      action: msg.action,
    });

    const outcome = await sendOne(vcp, msg, ctx, timeoutMs, i, runCtx);
    if (outcome) return outcome;
    if (msg.action === "StopTransaction") sentRecordedStop = true;
  }

  // Check for a stop request that arrived after the last message was sent.
  if (!stoppedNow && controller?.consumeStop()) {
    stoppedNow = true;
  }

  // Close the transaction with a synthetic Stop only when the recording had
  // none (e.g. an EndOfData session, or an early stop before its Stop was
  // reached). If the recorded StopTransaction was already played, sending
  // another would double-stop the transaction.
  const stopBody = sentRecordedStop
    ? undefined
    : synthesizeStopTransaction(session, ctx);
  if (stopBody) {
    emit(onEvent, {
      type: "message_send",
      ts: nowIso(),
      sessionIndex,
      messageIndex: session.messages.length,
      action: "StopTransaction",
    });
    try {
      await vcp.sendAndAwait(makeCall("StopTransaction", stopBody), {
        timeoutMs,
      });
    } catch (err) {
      logger.warn(`synthetic stop failed: ${JSON.stringify(err)}`);
      return stoppedNow
        ? { succeeded: true, truncated: true }
        : { succeeded: true, rejection: undefined };
    }
  }

  return stoppedNow
    ? { succeeded: true, truncated: true }
    : { succeeded: true };
}

async function sendOne(
  vcp: VCP,
  msg: ReplayMessage,
  ctx: SessionContext,
  timeoutMs: number,
  index: number,
  runCtx: SessionRunContext,
): Promise<SessionOutcome | undefined> {
  const body = applySubstitutions(msg.action, msg.body, ctx);

  // Defensive: if MV/Stop still lacks a usable txId, reject.
  if (
    (msg.action === "MeterValues" || msg.action === "StopTransaction") &&
    (body.transactionId === undefined || body.transactionId <= 0)
  ) {
    return {
      succeeded: false,
      rejection: {
        reason: "missing_transaction_id",
        failedAt: { action: msg.action, messageIndex: index },
        details: { transactionId: body.transactionId },
      },
    };
  }

  let result: unknown;
  try {
    result = await vcp.sendAndAwait(makeCall(msg.action, body), { timeoutMs });
  } catch (err) {
    const e = err as {
      kind?: string;
      code?: string;
      description?: string;
    };
    if (e.kind === "Timeout") {
      return {
        succeeded: false,
        rejection: {
          reason: "timeout",
          failedAt: { action: msg.action, messageIndex: index },
          details: {},
        },
      };
    }
    return {
      succeeded: false,
      rejection: {
        reason: "call_error",
        failedAt: { action: msg.action, messageIndex: index },
        details: { errorCode: e.code, errorDescription: e.description },
      },
    };
  }

  // Post-response capture.
  if (msg.action === "StartTransaction") {
    const r = result as {
      transactionId?: number;
      idTagInfo?: { status?: string };
    };
    if (r.idTagInfo?.status !== "Accepted") {
      return {
        succeeded: false,
        rejection: {
          reason: "id_tag_not_accepted",
          failedAt: { action: msg.action, messageIndex: index },
          details: r.idTagInfo,
        },
      };
    }
    emit(runCtx.onEvent, {
      type: "start_accepted",
      ts: nowIso(),
      sessionIndex: runCtx.sessionIndex,
      transactionId: r.transactionId,
    });
    if (typeof r.transactionId === "number") {
      ctx.capturedTxId = r.transactionId;
    }
    if (typeof body.meterStart === "number") {
      ctx.meterStartWh = body.meterStart;
    }
  } else if (msg.action === "Authorize") {
    const r = result as { idTagInfo?: { status?: string } };
    if (r.idTagInfo?.status !== "Accepted") {
      return {
        succeeded: false,
        rejection: {
          reason: "id_tag_not_accepted",
          failedAt: { action: msg.action, messageIndex: index },
          details: r.idTagInfo,
        },
      };
    }
  } else if (msg.action === "MeterValues") {
    const wh = extractEnergyWh(body);
    if (wh !== undefined) {
      ctx.lastEnergyWh =
        ctx.lastEnergyWh === undefined ? wh : Math.max(ctx.lastEnergyWh, wh);
    }
  }

  return undefined; // continue loop
}
