import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runReplay } from "../replayRunner";
import type { ReplayEvent } from "../events";

const __dirname = dirname(fileURLToPath(import.meta.url));

let logsDir: string;
beforeEach(() => {
  logsDir = mkdtempSync(join(tmpdir(), "replay-events-"));
});
afterEach(() => {
  /* tmpdir auto-cleaned by OS */
});

describe("runReplay emits lifecycle events", () => {
  it("emits run_start → bootstrap_done → session_start → message_send* → session_done → run_complete", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;
    let txCounter = 5000;
    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const [type, msgId, action] = JSON.parse(raw.toString());
        if (type !== 2) return;
        let res: unknown = {};
        if (action === "BootNotification")
          res = {
            status: "Accepted",
            currentTime: new Date().toISOString(),
            interval: 60,
          };
        else if (action === "StatusNotification") res = {};
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

    const events: ReplayEvent[] = [];
    const { exitCode } = await runReplay({
      replayFile: join(__dirname, "../../../tests/fixtures/replay/happy.json"),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
      onEvent: (e) => events.push(e),
    });
    wss.close();

    expect(exitCode).toBe(0);
    const seq = events.map((e) => e.type);
    expect(seq[0]).toBe("run_start");
    expect(seq).toContain("bootstrap_done");
    expect(seq).toContain("session_start");
    expect(seq.filter((t) => t === "message_send").length).toBeGreaterThan(0);
    expect(seq).toContain("session_done");
    expect(seq[seq.length - 1]).toBe("run_complete");

    const runStart = events.find((e) => e.type === "run_start");
    expect(runStart && "stationId" in runStart && runStart.stationId).toBe(
      "TEST_STATION",
    );
    expect(
      runStart && "totalSessions" in runStart && runStart.totalSessions,
    ).toBe(1);
  });

  it("emits session_rejected with reason on a failed session", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;
    let txCounter = 6000;
    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const [type, msgId, action, payload] = JSON.parse(raw.toString());
        if (type !== 2) return;
        let res: unknown = {};
        if (action === "BootNotification")
          res = {
            status: "Accepted",
            currentTime: new Date().toISOString(),
            interval: 60,
          };
        else if (action === "StatusNotification") res = {};
        else if (action === "StartTransaction")
          res =
            payload.idTag === "BAD"
              ? {
                  transactionId: ++txCounter,
                  idTagInfo: { status: "Blocked" },
                }
              : {
                  transactionId: ++txCounter,
                  idTagInfo: { status: "Accepted" },
                };
        else if (action === "StopTransaction")
          res = { idTagInfo: { status: "Accepted" } };
        ws.send(JSON.stringify([3, msgId, res]));
      });
    });

    const events: ReplayEvent[] = [];
    await runReplay({
      replayFile: join(
        __dirname,
        "../../../tests/fixtures/replay/reject-authorize.json",
      ),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
      onEvent: (e) => events.push(e),
    });
    wss.close();

    const rej = events.find((e) => e.type === "session_rejected");
    expect(rej).toBeDefined();
    expect(rej && "reason" in rej && rej.reason).toBe("id_tag_not_accepted");
  });
});
