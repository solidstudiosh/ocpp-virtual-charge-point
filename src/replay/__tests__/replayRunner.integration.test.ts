import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runReplay } from "../replayRunner";

const __dirname = dirname(fileURLToPath(import.meta.url));

let logsDir: string;
beforeEach(() => {
  logsDir = mkdtempSync(join(tmpdir(), "replay-test-"));
});
afterEach(() => {
  /* tmpdir auto-cleaned by OS */
});

describe("replayRunner happy path", () => {
  it("completes session, substitutes txId, synthesizes Stop", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;
    // biome-ignore lint/suspicious/noExplicitAny: collected
    const calls: { action: string; payload: any }[] = [];
    let txCounter = 1000;
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
        else if (action === "StartTransaction") {
          res = {
            transactionId: ++txCounter,
            idTagInfo: { status: "Accepted" },
          };
        } else if (action === "MeterValues") res = {};
        else if (action === "StopTransaction")
          res = { idTagInfo: { status: "Accepted" } };
        else if (action === "Heartbeat")
          res = { currentTime: new Date().toISOString() };
        ws.send(JSON.stringify([3, msgId, res]));
      });
    });

    const { exitCode } = await runReplay({
      replayFile: join(__dirname, "../../../tests/fixtures/replay/happy.json"),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
    });

    wss.close();

    expect(exitCode).toBe(0);
    const actions = calls.map((c) => c.action);
    expect(actions).toEqual([
      "BootNotification",
      "StatusNotification", // bootstrap SN
      "StatusNotification", // session SN(Preparing)
      "StartTransaction",
      "MeterValues",
      "StopTransaction", // synthesized
    ]);

    const mv = calls.find((c) => c.action === "MeterValues");
    expect(mv?.payload.transactionId).toBe(1001); // substituted from StartTransaction.conf

    const stop = calls.find((c) => c.action === "StopTransaction");
    expect(stop?.payload.transactionId).toBe(1001);
    expect(stop?.payload.meterStop).toBe(34500);
    expect(stop?.payload.timestamp).toBe("2026-02-05T11:22:38Z");
    expect(stop?.payload.reason).toBe("Local");

    const runs = readFileSync(join(logsDir, "runs.log"), "utf8")
      .trim()
      .split("\n");
    expect(runs.length).toBe(1);
    const summary = JSON.parse(runs[0]);
    expect(summary.sessionsSucceeded).toBe(1);
    expect(summary.sessionsRejected).toBe(0);
  });

  it("plays the recorded Stop and does not append a synthetic one", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;
    // biome-ignore lint/suspicious/noExplicitAny: collected
    const calls: { action: string; payload: any }[] = [];
    let txCounter = 4000;
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

    const { exitCode } = await runReplay({
      replayFile: join(
        __dirname,
        "../../../tests/fixtures/replay/recorded-stop.json",
      ),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
    });

    wss.close();

    expect(exitCode).toBe(0);
    // The recording carries the original session's positive txId (90000001);
    // the replay must pose as a new transaction and send the captured one.
    const mv = calls.find((c) => c.action === "MeterValues");
    expect(mv?.payload.transactionId).toBe(4001);
    const stops = calls.filter((c) => c.action === "StopTransaction");
    // Exactly one Stop, and it is the recorded one (not a synthetic "Local").
    expect(stops).toHaveLength(1);
    expect(stops[0].payload.reason).toBe("EVDisconnected");
    expect(stops[0].payload.meterStop).toBe(99999);
    expect(stops[0].payload.transactionId).toBe(4001); // captured txId substituted
  });
});

describe("replayRunner rejection paths", () => {
  it("logs rejection on idTag Blocked and continues to next session", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;
    let txCounter = 2000;
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
        else if (action === "StartTransaction") {
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
        } else if (action === "StopTransaction")
          res = { idTagInfo: { status: "Accepted" } };
        ws.send(JSON.stringify([3, msgId, res]));
      });
    });

    const { exitCode } = await runReplay({
      replayFile: join(
        __dirname,
        "../../../tests/fixtures/replay/reject-authorize.json",
      ),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
    });

    wss.close();

    expect(exitCode).toBe(0); // at least one session succeeded
    const rej = readFileSync(join(logsDir, "rej.log"), "utf8")
      .trim()
      .split("\n");
    expect(rej.length).toBe(1);
    const rec = JSON.parse(rej[0]);
    expect(rec.reason).toBe("id_tag_not_accepted");
    expect(rec.idTag).toBe("BAD");

    const summary = JSON.parse(
      readFileSync(join(logsDir, "runs.log"), "utf8").trim(),
    );
    expect(summary.sessionsSucceeded).toBe(1);
    expect(summary.sessionsRejected).toBe(1);
  });

  it("logs rejection on CallError", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;
    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const [type, msgId, action] = JSON.parse(raw.toString());
        if (type !== 2) return;
        if (action === "BootNotification") {
          ws.send(
            JSON.stringify([
              3,
              msgId,
              {
                status: "Accepted",
                currentTime: new Date().toISOString(),
                interval: 60,
              },
            ]),
          );
        } else if (action === "StatusNotification") {
          ws.send(JSON.stringify([3, msgId, {}]));
        } else if (action === "StartTransaction") {
          ws.send(JSON.stringify([4, msgId, "GenericError", "boom", {}]));
        } else {
          ws.send(JSON.stringify([3, msgId, {}]));
        }
      });
    });

    const { exitCode } = await runReplay({
      replayFile: join(
        __dirname,
        "../../../tests/fixtures/replay/call-error.json",
      ),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
    });

    wss.close();

    expect(exitCode).toBe(1); // all sessions rejected
    const rec = JSON.parse(
      readFileSync(join(logsDir, "rej.log"), "utf8").trim(),
    );
    expect(rec.reason).toBe("call_error");
    expect(rec.details.errorCode).toBe("GenericError");
  });

  it("auto-rejects server-initiated RemoteStartTransaction and continues replay", async () => {
    const wss = new WebSocketServer({ port: 0 });
    const port = (wss.address() as { port: number }).port;
    let txCounter = 3000;
    let serverPushed = false;
    // biome-ignore lint/suspicious/noExplicitAny: collected
    const replyFromVcp: { msgId: string; payload: any }[] = [];

    wss.on("connection", (ws) => {
      ws.on("message", (raw) => {
        const data = JSON.parse(raw.toString());
        const [type] = data;
        if (type === 2) {
          const [, msgId, action, payload] = data;
          let res: unknown = {};
          if (action === "BootNotification")
            res = {
              status: "Accepted",
              currentTime: new Date().toISOString(),
              interval: 60,
            };
          else if (action === "StatusNotification") {
            res = {};
            // Push a RemoteStartTransaction after the bootstrap StatusNotification.
            // We send it after replying so the VCP is ready for concurrent messages.
            if (!serverPushed && payload.connectorId === 0) {
              serverPushed = true;
              setImmediate(() => {
                ws.send(
                  JSON.stringify([
                    2,
                    "srv-1",
                    "RemoteStartTransaction",
                    { idTag: "X", connectorId: 1 },
                  ]),
                );
              });
            }
          } else if (action === "StartTransaction")
            res = {
              transactionId: ++txCounter,
              idTagInfo: { status: "Accepted" },
            };
          else if (action === "MeterValues") res = {};
          else if (action === "StopTransaction")
            res = { idTagInfo: { status: "Accepted" } };
          ws.send(JSON.stringify([3, msgId, res]));
        } else if (type === 3) {
          const [, msgId, payload] = data;
          replyFromVcp.push({ msgId, payload });
        }
      });
    });

    const { exitCode } = await runReplay({
      replayFile: join(__dirname, "../../../tests/fixtures/replay/happy.json"),
      endpoint: `ws://localhost:${port}`,
      rejectionsLogPath: join(logsDir, "rej.log"),
      runsLogPath: join(logsDir, "runs.log"),
      responseTimeoutMs: 5000,
    });

    wss.close();

    expect(exitCode).toBe(0);
    const remoteReply = replyFromVcp.find((r) => r.msgId === "srv-1");
    expect(remoteReply).toBeDefined();
    expect(remoteReply?.payload).toEqual({ status: "Rejected" });
  });
});
