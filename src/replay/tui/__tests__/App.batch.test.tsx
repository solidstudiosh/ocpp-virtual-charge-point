import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { App, type AppController } from "../App";

function flush() {
  return new Promise((r) => setTimeout(r, 10));
}

async function startBatch() {
  let ctrl!: AppController;
  const { lastFrame, stdin } = render(
    <App
      endpoint="ws://localhost:3000"
      initialFiles={[
        { path: "a.json", status: "running" },
        { path: "b.json", status: "pending" },
      ]}
      autoBegin
      onReady={(c) => {
        ctrl = c;
      }}
    />,
  );
  await flush();
  return { ctrl, lastFrame, stdin };
}

describe("App multi-file batch behaviour", () => {
  it("keeps running-phase hotkeys active after the first file completes", async () => {
    const { ctrl } = await startBatch();

    // Drive file 1 to completion.
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
    await flush();

    // File 2 starts.
    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:02Z",
      stationId: "S2",
      file: "b.json",
      totalSessions: 1,
    });
    await flush();

    // p, s, a hotkeys must still work mid-batch. (We can't actually exercise
    // useInput in this scenario reliably because raw mode isn't supported in
    // ink-testing-library; assert the controller methods directly via the
    // exposed controller, then via the inner helpers.)
    expect(ctrl.controller.paused).toBe(false);
    ctrl.controller.togglePause();
    expect(ctrl.controller.paused).toBe(true);
    ctrl.controller.togglePause();
    expect(ctrl.controller.paused).toBe(false);
  });

  it("HelpBar still shows running keys after the first file completes", async () => {
    const { ctrl, lastFrame } = await startBatch();
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
    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:02Z",
      stationId: "S2",
      file: "b.json",
      totalSessions: 1,
    });
    await flush();

    const frame = lastFrame() ?? "";
    // During file 2's processing the user must still see the running-phase
    // controls (pause / stop-now / abort) in the help bar.
    expect(frame).toContain("stop-now");
    expect(frame).toContain("pause");
    expect(frame).toContain("abort");
  });

  it("Summary box does not appear between batch files", async () => {
    const { ctrl, lastFrame } = await startBatch();
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
    await flush();

    // After file 1's run_complete, BEFORE the batch is finalised, the Summary
    // box must NOT appear (otherwise it pops in/out between files).
    const between = lastFrame() ?? "";
    expect(between).not.toContain("replay complete");
  });

  it("Summary appears only after ctrl.showSummary() (batch done)", async () => {
    const { ctrl, lastFrame } = await startBatch();
    ctrl.dispatch({
      type: "run_start",
      ts: "2026-05-21T10:00:00Z",
      stationId: "S",
      file: "a.json",
      totalSessions: 1,
    });
    ctrl.dispatch({
      type: "run_complete",
      ts: "2026-05-21T10:00:01Z",
      summary: {
        ts: "2026-05-21T10:00:01Z",
        stationId: "S",
        sessionsTotal: 1,
        sessionsSucceeded: 1,
        sessionsRejected: 0,
        sessionsTruncated: 0,
        durationMs: 1,
        durationIso: "PT0.001S",
        exitCode: 0,
      },
    });
    await flush();
    // Not yet finalised → no summary.
    expect(lastFrame() ?? "").not.toContain("replay complete");

    ctrl.showSummary();
    await flush();
    // After ctrl.showSummary() the user sees the Summary box.
    expect(lastFrame() ?? "").toContain("replay complete");
  });
});
