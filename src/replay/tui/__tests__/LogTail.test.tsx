import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { LogTail } from "../LogTail";
import type { LogLine } from "../state";

function makeLogs(n: number): LogLine[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    ts: `2026-05-21T10:00:${String(i).padStart(2, "0")}Z`,
    level: "info",
    message: `msg-${i}`,
  }));
}

function countLines(frame: string): number {
  return frame.split("\n").length;
}

describe("LogTail", () => {
  it("reserves a fixed visible area even when no logs exist", () => {
    const { lastFrame } = render(<LogTail logs={[]} rows={6} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("(no log lines yet)");
    // Borderless: exactly `rows` lines (placeholder + blank padding).
    expect(countLines(frame)).toBe(6);
  });

  it("does not grow taller than `rows` as logs accumulate", () => {
    const sparseFrame =
      render(<LogTail logs={makeLogs(2)} rows={6} />).lastFrame() ?? "";
    const fullFrame =
      render(<LogTail logs={makeLogs(100)} rows={6} />).lastFrame() ?? "";
    expect(countLines(fullFrame)).toBe(countLines(sparseFrame));
    expect(countLines(fullFrame)).toBe(6);
  });

  it("shows only the last `rows` log entries", () => {
    const { lastFrame } = render(<LogTail logs={makeLogs(20)} rows={6} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("msg-19");
    expect(frame).toContain("msg-14");
    expect(frame).not.toContain("msg-13");
    expect(frame).not.toContain("msg-0");
  });

  it("does not render a scroll indicator", () => {
    const { lastFrame } = render(<LogTail logs={makeLogs(20)} rows={6} />);
    const frame = lastFrame() ?? "";
    expect(frame).not.toMatch(/showing\s+\d+.*\s+of\s+\d+/);
  });

  it("truncates messages that exceed the given width", () => {
    const longMessage = "x".repeat(500);
    const { lastFrame } = render(
      <LogTail
        logs={[
          {
            id: 0,
            ts: "2026-05-21T10:00:00Z",
            level: "info",
            message: longMessage,
          },
        ]}
        rows={6}
        width={60}
      />,
    );
    const frame = lastFrame() ?? "";
    for (const line of frame.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });
});
