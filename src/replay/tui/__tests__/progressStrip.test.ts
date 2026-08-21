import { describe, expect, it } from "vitest";
import { initialState } from "../state";
import { renderView } from "../testHarness";
import { color } from "../theme";
import { createProgressBar } from "../widgets/progressBar";
import { barWidthFor, createProgressStrip } from "../widgets/progressStrip";

describe("barWidthFor", () => {
  it("returns the wide bar width at and above the 78-column threshold", () => {
    expect(barWidthFor(80)).toBe(10);
    expect(barWidthFor(78)).toBe(10);
  });

  it("returns the narrow bar width between the 60 and 78 thresholds", () => {
    expect(barWidthFor(77)).toBe(6);
    expect(barWidthFor(64)).toBe(6);
    expect(barWidthFor(60)).toBe(6);
  });

  it("collapses to 0 below the 60-column threshold", () => {
    expect(barWidthFor(59)).toBe(0);
    expect(barWidthFor(40)).toBe(0);
  });
});

describe("ProgressStrip", () => {
  const state = {
    ...initialState,
    batchSessionsDone: 1,
    batchTotalSessions: 4,
    batchMessagesSent: 3,
    batchTotalMessages: 12,
    currentSessionMessagesSent: 1,
    currentSessionMessagesPlanned: 2,
  };

  it("renders all three labels and a percentage", async () => {
    const h = await renderView(
      createProgressStrip,
      { state, width: 80 },
      { width: 80, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).toContain("Sess");
    expect(frame).toContain("Msg");
    expect(frame).toContain("Cur");
    expect(frame).toContain("25%");
    h.destroy();
  });

  it("shows the bar glyphs on a wide terminal", async () => {
    const h = await renderView(
      createProgressStrip,
      { state, width: 80 },
      { width: 80, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).toContain("█");
    expect(frame).toContain("░");
    h.destroy();
  });

  it("collapses the bar glyphs on narrow terminals", async () => {
    const h = await renderView(
      createProgressStrip,
      { state, width: 40 },
      { width: 40, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).not.toContain("█");
    expect(frame).not.toContain("░");
    // Labels and the percentage stay visible even with the glyphs gone.
    expect(frame).toContain("Sess");
    expect(frame).toContain("25%");
    h.destroy();
  });
});

describe("ProgressBar percentage", () => {
  it("shows 0% rather than NaN% when total is zero", async () => {
    const h = await renderView(
      createProgressBar,
      { label: "Test", current: 0, total: 0, barWidth: 10, fg: color.accent },
      { width: 40, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).not.toContain("NaN");
    expect(frame).toContain("0%");
    h.destroy();
  });

  it("clamps to 100% when current exceeds total", async () => {
    const h = await renderView(
      createProgressBar,
      {
        label: "Test",
        current: 10,
        total: 5,
        barWidth: 10,
        fg: color.accent,
      },
      { width: 40, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).toContain("100%");
    h.destroy();
  });

  it("shows 0% when current is zero with a positive total", async () => {
    const h = await renderView(
      createProgressBar,
      { label: "Test", current: 0, total: 5, barWidth: 10, fg: color.accent },
      { width: 40, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).toContain("0%");
    h.destroy();
  });
});
