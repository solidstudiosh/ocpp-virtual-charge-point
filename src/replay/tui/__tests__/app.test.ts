import { createTestRenderer } from "@opentui/core/testing";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

async function mount(options = {}) {
  const t = await createTestRenderer({ width: 90, height: 22 });
  const app = createApp(t.renderer, {
    endpoint: "ws://localhost:3000",
    initialFiles: [{ path: "./data/demo.json", status: "pending" }],
    autoBegin: true,
    ...options,
  });
  t.renderer.root.add(app.root);
  const frame = async () => {
    await t.waitForVisualIdle();
    await t.renderOnce();
    return t.captureCharFrame();
  };
  return { app, frame };
}

describe("app", () => {
  it("renders the dashboard and reflects dispatched events", async () => {
    const { app, frame } = await mount();
    app.controller.dispatch({
      type: "run_start",
      ts: "2026-08-21T10:00:00Z",
      stationId: "CS_TEST_1",
      file: "./data/demo.json",
      totalSessions: 1,
    });
    app.controller.dispatch({
      type: "session_start",
      ts: "2026-08-21T10:00:01Z",
      sessionIndex: 0,
      connectorId: "1",
      idTag: "RFID_TEST_1",
      windowStart: "2026-08-21T10:00:00Z",
      messagesPlanned: 2,
    });
    const out = await frame();
    expect(out).toContain("CS_TEST_1");
    expect(out).toContain("cid=1");
    app.destroy();
  });

  it("routes running-phase keys to the replay controller", async () => {
    const { app, frame } = await mount();
    expect(app.controller.controller.paused).toBe(false);
    app.handleKey({ name: "p" });
    expect(app.controller.controller.paused).toBe(true);
    expect(await frame()).toContain("paused");
    app.destroy();
  });

  it("switches to the summary screen and offers another round", async () => {
    const onRoundChoice = vi.fn();
    const { app, frame } = await mount({ onRoundChoice });
    app.controller.showSummary();
    expect(await frame()).toContain("COMPLETE");

    app.handleKey({ name: "f" });
    expect(onRoundChoice).toHaveBeenCalledWith("again");
    expect(await frame()).toContain("SELECT FILES");
    app.destroy();
  });

  it("reflows on resize without losing state", async () => {
    const { app, frame } = await mount();
    app.controller.dispatch({
      type: "run_start",
      ts: "2026-08-21T10:00:00Z",
      stationId: "CS_TEST_1",
      file: "./data/demo.json",
      totalSessions: 1,
    });
    app.resize(58, 12);
    expect(await frame()).toContain("CS_TEST_1");
    app.destroy();
  });

  it("ignores keys bound to inactive phases", async () => {
    const onRoundChoice = vi.fn();
    const { app } = await mount({ onRoundChoice });
    // "f" belongs to the complete phase; we are still running.
    app.handleKey({ name: "f" });
    expect(onRoundChoice).not.toHaveBeenCalled();
    app.destroy();
  });
});
