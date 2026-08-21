import { describe, expect, it } from "vitest";
import { initialState } from "../state";
import { renderView } from "../testHarness";
import { createRunScreen } from "../screens/run";

const props = (over = {}) => ({
  state: {
    ...initialState,
    phase: "running" as const,
    stationId: "CS_TEST_1",
    file: "./data/demo.json",
    sessions: [{ index: 0, status: "running" as const, connectorId: "1" }],
    successfulStarts: 2,
    rejected: 1,
    truncated: 0,
    logs: [
      {
        id: 1,
        ts: "2026-08-21T10:00:00Z",
        level: "info",
        message: "hello-log",
      },
    ],
  },
  files: [{ path: "./data/demo.json", status: "running" as const }],
  currentIndex: 0,
  width: 90,
  height: 20,
  elapsedMs: 65_000,
  paused: false,
  fileLogEnabled: false,
  showHelp: false,
  ...over,
});

describe("run screen", () => {
  it("shows station, file, tally, session row and log line", async () => {
    const h = await renderView(createRunScreen, props(), {
      width: 90,
      height: 20,
    });
    const frame = await h.frame();
    expect(frame).toContain("REPLAY");
    expect(frame).toContain("CS_TEST_1");
    expect(frame).toContain("demo.json");
    expect(frame).toContain("SESSIONS");
    expect(frame).toContain("cid=1");
    expect(frame).toContain("hello-log");
    expect(frame).toContain("1m5.0s");
    h.destroy();
  });

  it("surfaces paused and REC indicators only when active", async () => {
    const h = await renderView(createRunScreen, props(), {
      width: 90,
      height: 20,
    });
    const inactive = await h.frame();
    expect(inactive).not.toContain("paused");
    expect(inactive).not.toContain("REC");

    h.view.update(props({ paused: true, fileLogEnabled: true }));
    const active = await h.frame();
    expect(active).toContain("paused");
    expect(active).toContain("REC");
    h.destroy();
  });

  it("toggles the expanded help block", async () => {
    const h = await renderView(createRunScreen, props(), {
      width: 90,
      height: 20,
    });
    const collapsed = await h.frame();
    expect(collapsed).not.toContain("stop the current session now");

    h.view.update(props({ showHelp: true }));
    const expanded = await h.frame();
    expect(expanded).toContain("stop the current session now");
    h.destroy();
  });

  it("stacks sessions and log columns vertically below the narrow-width threshold", async () => {
    const wide = await renderView(createRunScreen, props({ width: 90 }), {
      width: 90,
      height: 20,
    });
    const wideLines = (await wide.frame()).split("\n");
    const wideSessionsRow = wideLines.findIndex((l) => l.includes("SESSIONS"));
    const wideLogRow = wideLines.findIndex((l) => l.includes("LOG"));
    wide.destroy();

    expect(wideSessionsRow).toBeGreaterThanOrEqual(0);
    expect(wideLogRow).toBeGreaterThanOrEqual(0);
    // Wide layout: the two columns sit side by side, so their first lines
    // ("SESSIONS ..." and "LOG") land on the very same terminal row.
    expect(wideSessionsRow).toBe(wideLogRow);

    const narrow = await renderView(createRunScreen, props({ width: 40 }), {
      width: 40,
      height: 30,
    });
    const narrowLines = (await narrow.frame()).split("\n");
    const narrowSessionsRow = narrowLines.findIndex((l) =>
      l.includes("SESSIONS"),
    );
    const narrowLogRow = narrowLines.findIndex((l) => l.includes("LOG"));
    narrow.destroy();

    expect(narrowSessionsRow).toBeGreaterThanOrEqual(0);
    expect(narrowLogRow).toBeGreaterThanOrEqual(0);
    // Narrow layout: the columns stack, so the LOG column's first line is
    // well below the SESSIONS column's first line, not on the same row.
    expect(narrowLogRow).toBeGreaterThan(narrowSessionsRow + 1);
  });
});
