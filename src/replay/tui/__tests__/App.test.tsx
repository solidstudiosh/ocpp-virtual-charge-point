import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { App, type AppController } from "../App";

function flushFrames() {
  return new Promise((r) => setTimeout(r, 10));
}

describe("App renders a frame for each event", () => {
  it("shows station, session row, and final summary", async () => {
    let ctrl!: AppController;
    const { lastFrame, frames } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[{ path: "happy.json", status: "running" }]}
        autoBegin
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flushFrames();

    ctrl.dispatch({
      type: "batch_start",
      ts: "2026-05-20T09:59:59Z",
      totalFiles: 1,
      totalSessions: 1,
      totalMessages: 3,
    });
    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-20T10:00:00Z",
      stationId: "STN",
      file: "happy.json",
      totalSessions: 1,
    });
    ctrl.dispatch({
      type: "session_start",
      ts: "2026-05-20T10:00:01Z",
      sessionIndex: 0,
      connectorId: "1",
      idTag: "TAG",
      windowStart: "2026-05-20T10:00:00Z",
      messagesPlanned: 3,
    });
    ctrl.dispatch({
      type: "message_send",
      ts: "2026-05-20T10:00:02Z",
      sessionIndex: 0,
      messageIndex: 0,
      action: "StartTransaction",
    });
    await flushFrames();

    // Station id and file name are shown in the dashboard frame title.
    const allOutput = frames.join("\n");
    expect(allOutput).toContain("STN");
    expect(allOutput).toContain("happy.json");
    const mid = lastFrame() ?? "";
    expect(mid).toContain("StartTransaction");
    expect(mid).toContain("cid=1");
    // Compact single-line progress strip (Sess / Msg / Cur).
    expect(mid).toContain("Sess");
    expect(mid).toContain("Msg");
    expect(mid).toContain("Cur");

    ctrl.dispatch({
      type: "session_done",
      ts: "2026-05-20T10:00:03Z",
      sessionIndex: 0,
    });
    ctrl.dispatch({
      type: "run_complete",
      ts: "2026-05-20T10:00:04Z",
      summary: {
        ts: "2026-05-20T10:00:04Z",
        stationId: "STN",
        sessionsTotal: 1,
        sessionsSucceeded: 1,
        sessionsRejected: 0,
        sessionsTruncated: 0,
        durationMs: 4000,
        durationIso: "PT4S",
        exitCode: 0,
      },
    });
    // The batch driver signals "batch done" via ctrl.showSummary(); only then
    // does the summary screen appear.
    ctrl.showSummary();
    await flushFrames();

    const final = lastFrame() ?? "";
    expect(final).toContain("replay complete");
    // Batch duration comes from the archived per-file summaries (4000 ms).
    expect(final).toContain("4.0s");
  });

  it("f on the summary screen returns to selection, keeping idTag", async () => {
    let ctrl!: AppController;
    const choices: string[] = [];
    const { lastFrame, stdin } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[{ path: "a.json", status: "running" }]}
        autoBegin
        initialIdTag="KEEPME"
        onRoundChoice={(c) => choices.push(c)}
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flushFrames();
    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:00Z",
      stationId: "S1",
      file: "a.json",
      totalSessions: 1,
    });
    ctrl.dispatch({
      type: "run_complete",
      ts: "2026-05-21T10:00:01Z",
      summary: {
        ts: "2026-05-21T10:00:01Z",
        stationId: "S1",
        sessionsTotal: 1,
        sessionsSucceeded: 1,
        sessionsRejected: 0,
        sessionsTruncated: 0,
        durationMs: 1,
        durationIso: "PT0.001S",
        exitCode: 0,
      },
    });
    ctrl.showSummary();
    await flushFrames();
    expect(lastFrame() ?? "").toContain("replay complete");

    // Arm controller flags as if the round had been aborted; f must clear them.
    ctrl.controller.requestAbort();
    stdin.write("f");
    await flushFrames();

    const frame = lastFrame() ?? "";
    expect(choices).toEqual(["again"]);
    expect(frame).toContain("SELECT FILES");
    // Selection is cleared for the new round…
    expect(frame).toContain("0 selected");
    // …but the idTag override is kept.
    expect(frame).toContain("KEEPME");
    expect(ctrl.controller.abortRequested).toBe(false);
  });

  it("f returns to selection in the directory the user navigated to, not the launch cwd", async () => {
    // Round 1: navigate into a subdirectory, select a file there, and run.
    // After pressing f the browser must reopen in that subdirectory (its
    // listing, e.g. run1.json, is visible) rather than resetting to the
    // launch cwd (whose listing is the `scenarios/` folder). The Directory
    // pane — not the title — is the discriminator: the title tracks
    // browserCwd state, which has a transient on remount.
    const root = mkdtempSync(join(tmpdir(), "replay-cwd-"));
    const subdir = join(root, "scenarios");
    mkdirSync(subdir);
    writeFileSync(join(subdir, "run1.json"), "{}");

    let ctrl!: AppController;
    const { lastFrame, stdin } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[]}
        cwd={root}
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flushFrames();
    // Sanity: launch cwd lists the subdirectory, not the file inside it.
    expect(lastFrame() ?? "").toContain("scenarios");

    // Move cursor to `scenarios/` (index 0 is `..`) and enter it.
    stdin.write("[B"); // down arrow
    await flushFrames();
    stdin.write("\r"); // enter the directory
    await flushFrames();
    expect(lastFrame() ?? "").toContain("run1.json");

    // Select run1.json (cursor 0 is `..`) and begin the run.
    stdin.write("[B"); // down arrow → run1.json
    await flushFrames();
    stdin.write(" "); // toggle-select
    await flushFrames();
    stdin.write("B"); // begin
    await flushFrames();

    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:00Z",
      stationId: "S1",
      file: join(subdir, "run1.json"),
      totalSessions: 1,
    });
    ctrl.dispatch({
      type: "run_complete",
      ts: "2026-05-21T10:00:01Z",
      summary: {
        ts: "2026-05-21T10:00:01Z",
        stationId: "S1",
        sessionsTotal: 1,
        sessionsSucceeded: 1,
        sessionsRejected: 0,
        sessionsTruncated: 0,
        durationMs: 1,
        durationIso: "PT0.001S",
        exitCode: 0,
      },
    });
    ctrl.showSummary();
    await flushFrames();
    expect(lastFrame() ?? "").toContain("replay complete");

    stdin.write("f");
    await flushFrames();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("SELECT FILES");
    // Still in the subdirectory: its file is listed, selection was cleared.
    expect(frame).toContain("run1.json");
    expect(frame).toContain("0 selected");

    rmSync(root, { recursive: true, force: true });
  });

  it("q on the summary screen resolves the round as quit", async () => {
    let ctrl!: AppController;
    const choices: string[] = [];
    const { stdin } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[{ path: "a.json", status: "running" }]}
        autoBegin
        onRoundChoice={(c) => choices.push(c)}
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flushFrames();
    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:00Z",
      stationId: "S1",
      file: "a.json",
      totalSessions: 1,
    });
    ctrl.dispatch({
      type: "run_complete",
      ts: "2026-05-21T10:00:01Z",
      summary: {
        ts: "2026-05-21T10:00:01Z",
        stationId: "S1",
        sessionsTotal: 1,
        sessionsSucceeded: 1,
        sessionsRejected: 0,
        sessionsTruncated: 0,
        durationMs: 1,
        durationIso: "PT0.001S",
        exitCode: 0,
      },
    });
    ctrl.showSummary();
    await flushFrames();

    stdin.write("q");
    await flushFrames();
    expect(choices).toEqual(["quit"]);
  });

  it("p toggles pause via the exposed controller, s arms stopRequested", async () => {
    let ctrl!: AppController;
    const { lastFrame, stdin } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[{ path: "two.json", status: "running" }]}
        autoBegin
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flushFrames();

    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:00Z",
      stationId: "STN2",
      file: "two.json",
      totalSessions: 1,
    });
    await flushFrames();

    expect(ctrl.controller.paused).toBe(false);
    stdin.write("p");
    await flushFrames();
    expect(ctrl.controller.paused).toBe(true);
    expect(lastFrame() ?? "").toContain("paused");

    stdin.write("p");
    await flushFrames();
    expect(ctrl.controller.paused).toBe(false);

    expect(ctrl.controller.stopRequested).toBe(false);
    stdin.write("s");
    await flushFrames();
    expect(ctrl.controller.stopRequested).toBe(true);
  });

  it("successfulStarts counter tracks start_accepted and decrements on rejection", async () => {
    let ctrl!: AppController;
    const { lastFrame } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[{ path: "x.json", status: "running" }]}
        autoBegin
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flushFrames();

    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:00Z",
      stationId: "STN3",
      file: "x.json",
      totalSessions: 2,
    });
    ctrl.dispatch({
      type: "session_start",
      ts: "2026-05-21T10:00:01Z",
      sessionIndex: 0,
      connectorId: "1",
      idTag: "T",
      windowStart: "2026-05-21T10:00:00Z",
      messagesPlanned: 5,
    });
    ctrl.dispatch({
      type: "start_accepted",
      ts: "2026-05-21T10:00:02Z",
      sessionIndex: 0,
      transactionId: 1,
    });
    await flushFrames();
    expect(lastFrame() ?? "").toContain("✓1");

    ctrl.dispatch({
      type: "session_rejected",
      ts: "2026-05-21T10:00:03Z",
      sessionIndex: 0,
      reason: "timeout",
      details: {},
      failedAt: { action: "MeterValues", messageIndex: 3 },
    });
    await flushFrames();
    // Bumped to 1 on start_accepted, decremented to 0 on rejection.
    expect(lastFrame() ?? "").toContain("✓0");
  });

  it("file-log toggle writes a per-session log on session end", async () => {
    const dir = mkdtempSync(join(tmpdir(), "session-logs-"));
    let ctrl!: AppController;
    const { stdin } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[{ path: "y.json", status: "running" }]}
        autoBegin
        sessionLogDir={dir}
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flushFrames();

    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:00Z",
      stationId: "STN_FL",
      file: "y.json",
      totalSessions: 1,
    });
    await flushFrames();
    stdin.write("l");
    await flushFrames();

    ctrl.dispatch({
      type: "session_start",
      ts: "2026-05-21T10:00:01Z",
      sessionIndex: 0,
      connectorId: "1",
      idTag: "T",
      windowStart: "2026-05-21T10:00:00Z",
      messagesPlanned: 2,
    });
    ctrl.dispatch({
      type: "log",
      ts: "2026-05-21T10:00:02Z",
      level: "info",
      message: "first log entry",
    });
    ctrl.dispatch({
      type: "log",
      ts: "2026-05-21T10:00:03Z",
      level: "warn",
      message: "second log entry",
    });
    ctrl.dispatch({
      type: "session_done",
      ts: "2026-05-21T10:00:04Z",
      sessionIndex: 0,
    });
    await flushFrames();

    const written = readdirSync(dir);
    expect(written.length).toBe(1);
    expect(written[0]).toMatch(/STN_FL-s000-done/);
    const body = readFileSync(join(dir, written[0]), "utf8");
    expect(body).toContain("first log entry");
    expect(body).toContain("second log entry");
    expect(body).toContain("# stationId=STN_FL");
  });
});
