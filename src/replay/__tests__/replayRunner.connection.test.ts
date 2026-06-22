import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { runReplay } from "../replayRunner";
import type { ReplayFile } from "../types";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "replay-conn-"));
});
afterEach(() => {
  /* tmpdir auto-cleaned by OS */
});

function writeReplayFile(file: ReplayFile): string {
  const path = join(dir, "replay.json");
  writeFileSync(path, JSON.stringify(file), "utf8");
  return path;
}

/**
 * Spin up a mock CSMS that records the connection URL path and basic-auth
 * header, then answers BootNotification/StatusNotification so the runner
 * reaches `run_complete`.
 */
function startCapturingServer() {
  const wss = new WebSocketServer({ port: 0 });
  const port = (wss.address() as { port: number }).port;
  const captured: { path?: string; user?: string; password?: string } = {};
  wss.on("connection", (ws, req) => {
    captured.path = req.url;
    const auth = req.headers.authorization;
    if (auth?.startsWith("Basic ")) {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      captured.user = decoded.slice(0, idx);
      captured.password = decoded.slice(idx + 1);
    }
    ws.on("message", (raw) => {
      const [type, msgId, action] = JSON.parse(raw.toString());
      if (type !== 2) return;
      const res =
        action === "BootNotification"
          ? {
              status: "Accepted",
              currentTime: new Date().toISOString(),
              interval: 60,
            }
          : {};
      ws.send(JSON.stringify([3, msgId, res]));
    });
  });
  return { wss, port, captured };
}

const baseOpts = (replayFile: string, port: number, logsDir: string) => ({
  replayFile,
  endpoint: `ws://localhost:${port}`,
  rejectionsLogPath: join(logsDir, "rej.log"),
  runsLogPath: join(logsDir, "runs.log"),
  responseTimeoutMs: 5000,
});

describe("runReplay resolves connection identity per file", () => {
  it("connects with the file's stationId over the env default id", async () => {
    const path = writeReplayFile({ stationId: "FILE_ID", sessions: [] });
    const { wss, port, captured } = startCapturingServer();
    await runReplay({
      ...baseOpts(path, port, dir),
      cpIdDefault: "ENV_ID",
    });
    wss.close();
    // The OCPP id rides in the URL path regardless of auth.
    expect(captured.path).toBe("/FILE_ID");
  });

  it("uses the file's password for basic auth", async () => {
    const path = writeReplayFile({
      stationId: "FILE_ID",
      password: "filepw",
      sessions: [],
    });
    const { wss, port, captured } = startCapturingServer();
    await runReplay({
      ...baseOpts(path, port, dir),
      passwordDefault: "envpw",
    });
    wss.close();
    expect(captured.password).toBe("filepw");
  });

  it("falls back to the env password when the file has none", async () => {
    const path = writeReplayFile({ stationId: "FILE_ID", sessions: [] });
    const { wss, port, captured } = startCapturingServer();
    await runReplay({
      ...baseOpts(path, port, dir),
      passwordDefault: "envpw",
    });
    wss.close();
    expect(captured.password).toBe("envpw");
  });

  it("lets CLI force values override the file", async () => {
    const path = writeReplayFile({
      stationId: "FILE_ID",
      password: "filepw",
      sessions: [],
    });
    const { wss, port, captured } = startCapturingServer();
    await runReplay({
      ...baseOpts(path, port, dir),
      cpIdForce: "FORCED",
      passwordForce: "clipw",
    });
    wss.close();
    expect(captured.path).toBe("/FORCED");
    expect(captured.user).toBe("FORCED");
    expect(captured.password).toBe("clipw");
  });

  it("exits with an error when no id can be resolved", async () => {
    const path = writeReplayFile({
      stationId: "",
      sessions: [],
    } as unknown as ReplayFile);
    const { wss, port } = startCapturingServer();
    const { exitCode } = await runReplay(baseOpts(path, port, dir));
    wss.close();
    expect(exitCode).not.toBe(0);
  });
});
