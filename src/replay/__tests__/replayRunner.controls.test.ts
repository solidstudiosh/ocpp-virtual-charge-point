import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runReplay } from "../replayRunner";
import { createReplayController } from "../controller";
import type { ReplayEvent } from "../events";

const __dirname = dirname(fileURLToPath(import.meta.url));

let logsDir: string;
beforeEach(() => {
  logsDir = mkdtempSync(join(tmpdir(), "replay-controls-"));
});
afterEach(() => {
  /* tmpdir auto-cleaned by OS */
});

function startStub() {
  const wss = new WebSocketServer({ port: 0 });
  const port = (wss.address() as { port: number }).port;
  // biome-ignore lint/suspicious/noExplicitAny: collected
  const calls: { action: string; payload: any }[] = [];
  let txCounter = 7000;
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const [type, msgId, action, payload] = JSON.parse(raw.toString());
      if (type !== 2) return;
      calls.push({ action, payload });
      let res: unknown = {};
      if (action === "BootNotification")
        res = {
          status: "Accepted",
          currentTime: new Date().toISOString(),
          interval: 60,
        };
      else if (action === "StatusNotification") res = {};
      else if (action === "Authorize")
        res = { idTagInfo: { status: "Accepted" } };
      else if (action === "StartTransaction")
        res = {
          transactionId: ++txCounter,
          idTagInfo: { status: "Accepted" },
        };
      else if (action === "MeterValues") res = {};
      else if (action === "StopTransaction")
        res = { idTagInfo: { status: "Accepted" } };
      ws.send(JSON.stringify([3, msgId, res]));
    });
  });
  return { wss, port, calls };
}

describe("runReplay controls", () => {
  it("pause halts message-send between messages, resume continues", async () => {
    const { wss, port } = startStub();
    const ctrl = createReplayController();
    const events: ReplayEvent[] = [];
    let pausedOnce = false;
    let firstMessageSeen: () => void;
    const firstMessage = new Promise<void>((resolve) => {
      firstMessageSeen = resolve;
    });

    const runPromise = runReplay({
      replayFile: join(__dirname, "../../../tests/fixtures/replay/happy.json"),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
      controller: ctrl,
      onEvent: (e) => {
        events.push(e);
        if (!pausedOnce && e.type === "message_send") {
          pausedOnce = true;
          ctrl.pause();
          firstMessageSeen();
        }
      },
    });

    await firstMessage;
    expect(ctrl.paused).toBe(true);
    const beforeResume = events.filter((e) => e.type === "message_send").length;

    await new Promise((r) => setTimeout(r, 100));
    const stillBefore = events.filter((e) => e.type === "message_send").length;
    expect(stillBefore).toBe(beforeResume);

    ctrl.resume();
    const result = await runPromise;
    wss.close();
    expect(result.exitCode).toBe(0);
    expect(
      events.filter((e) => e.type === "message_send").length,
    ).toBeGreaterThan(beforeResume);
  });

  it("stop-now sends synthetic StopTransaction with last MV", async () => {
    const { wss, port, calls } = startStub();
    const ctrl = createReplayController();
    let stopped = false;

    const result = await runReplay({
      replayFile: join(__dirname, "../../../tests/fixtures/replay/happy.json"),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
      controller: ctrl,
      onEvent: (e) => {
        if (
          !stopped &&
          e.type === "message_send" &&
          e.action === "MeterValues"
        ) {
          stopped = true;
          ctrl.requestStop();
        }
      },
    });
    wss.close();

    expect(result.exitCode).toBe(0);
    expect(result.summary.sessionsTruncated).toBe(1);
    expect(result.summary.sessionsSucceeded).toBe(0);
    const stop = calls.find((c) => c.action === "StopTransaction");
    expect(stop).toBeDefined();
    expect(stop?.payload.meterStop).toBe(34500);
  });

  it("stop-now before StartTransaction marks truncated without sending Stop", async () => {
    const { wss, port, calls } = startStub();
    const ctrl = createReplayController();
    let armed = false;

    const result = await runReplay({
      replayFile: join(__dirname, "../../../tests/fixtures/replay/happy.json"),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
      controller: ctrl,
      onEvent: (e) => {
        if (!armed && e.type === "bootstrap_done") {
          armed = true;
          ctrl.requestStop();
        }
      },
    });
    wss.close();

    expect(result.summary.sessionsTruncated).toBe(1);
    expect(calls.find((c) => c.action === "StopTransaction")).toBeUndefined();
  });

  it("abort exits after current session, exit code 4, emits run_aborted", async () => {
    const { wss, port } = startStub();
    const ctrl = createReplayController();
    const events: ReplayEvent[] = [];

    const result = await runReplay({
      replayFile: join(
        __dirname,
        "../../../tests/fixtures/replay/two-sessions.json",
      ),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
      controller: ctrl,
      onEvent: (e) => {
        events.push(e);
        if (e.type === "session_done" && e.sessionIndex === 0) {
          ctrl.requestAbort();
        }
      },
    });
    wss.close();

    expect(result.exitCode).toBe(4);
    const sessionStarts = events.filter((e) => e.type === "session_start");
    expect(sessionStarts.length).toBe(1);
    expect(events.some((e) => e.type === "run_aborted")).toBe(true);
  });
});
