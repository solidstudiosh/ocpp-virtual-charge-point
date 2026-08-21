import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import type { LogLine } from "../state";
import { createLogTail } from "../widgets/logTail";

const line = (id: number, message: string, level = "info"): LogLine => ({
  id,
  message,
  level,
  ts: "2026-08-21T10:00:00Z",
});

describe("LogTail", () => {
  it("shows a placeholder when empty", async () => {
    const h = await renderView(
      createLogTail,
      { logs: [], height: 5 },
      { width: 40, height: 6 },
    );
    expect(await h.frame()).toContain("(no log lines yet)");
    h.destroy();
  });

  it("appends new lines without rebuilding existing ones", async () => {
    const h = await renderView(
      createLogTail,
      { logs: [line(1, "first")], height: 5 },
      { width: 40, height: 6 },
    );
    expect(await h.frame()).toContain("first");

    h.view.update({ logs: [line(1, "first"), line(2, "second")], height: 5 });
    const after = await h.frame();
    expect(after).toContain("first");
    expect(after).toContain("second");
    h.destroy();
  });

  it("keeps the newest line visible once the buffer overflows", async () => {
    const logs = Array.from({ length: 40 }, (_, i) => line(i, `entry-${i}`));
    const h = await renderView(
      createLogTail,
      { logs, height: 5 },
      { width: 40, height: 6 },
    );
    const frame = await h.frame();
    expect(frame).toContain("entry-39");
    expect(frame).not.toContain("entry-0");
    h.destroy();
  });
});
