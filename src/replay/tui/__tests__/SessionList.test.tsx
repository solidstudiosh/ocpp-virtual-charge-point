import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { SessionList } from "../SessionList";
import type { SessionRow } from "../state";

function row(overrides: Partial<SessionRow>): SessionRow {
  return {
    index: 0,
    connectorId: "1",
    idTag: "TAG",
    status: "pending",
    ...overrides,
  };
}

describe("SessionList", () => {
  it("renders distinct icons for done, rejected, running, pending", () => {
    const sessions: SessionRow[] = [
      row({ index: 0, status: "done" }),
      row({ index: 1, status: "rejected", reason: "timeout" }),
      row({ index: 2, status: "running" }),
      row({ index: 3, status: "pending" }),
    ];
    const frame = render(<SessionList sessions={sessions} />).lastFrame() ?? "";
    expect(frame).toContain("✓ #  0");
    expect(frame).toContain("✗ #  1");
    expect(frame).toContain("▶ #  2");
    expect(frame).toContain("· #  3");
  });

  it("renders the ⊘ icon for truncated sessions (matches StatusBar)", () => {
    const sessions: SessionRow[] = [
      row({ index: 0, status: "truncated" }),
      row({ index: 1, status: "pending" }),
    ];
    const frame = render(<SessionList sessions={sessions} />).lastFrame() ?? "";
    // Truncated must be visually distinguishable from pending, matching the
    // StatusBar's ⊘ glyph for consistency.
    expect(frame).toContain("⊘ #  0");
    expect(frame).toContain("· #  1");
  });
});
