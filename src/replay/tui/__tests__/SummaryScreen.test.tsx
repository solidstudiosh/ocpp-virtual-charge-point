import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { SummaryScreen, buildSummaryLines } from "../SummaryScreen";
import type { FileResult } from "../state";

function flush() {
  return new Promise((r) => setTimeout(r, 10));
}

const summary = {
  ts: "2026-05-20T10:00:00.000Z",
  stationId: "S1",
  sessionsTotal: 3,
  sessionsSucceeded: 1,
  sessionsRejected: 1,
  sessionsTruncated: 1,
  durationMs: 4000,
  durationIso: "PT4S",
  exitCode: 2,
};

const results: FileResult[] = [
  {
    file: "/data/a.json",
    stationId: "S1",
    summary,
    sessions: [
      {
        index: 0,
        connectorId: "1",
        idTag: "RFID_TEST_1",
        txId: 1042,
        status: "done",
      },
      {
        index: 1,
        connectorId: "1",
        idTag: "RFID_TEST_2",
        status: "rejected",
        reason: "id_tag_not_accepted",
        failedAt: { action: "Authorize", messageIndex: 2 },
      },
      {
        index: 2,
        connectorId: "2",
        idTag: "RFID_TEST_3",
        txId: 1043,
        status: "truncated",
      },
    ],
  },
];

describe("buildSummaryLines", () => {
  it("emits a file header plus one line per session", () => {
    const lines = buildSummaryLines(results);
    const texts = lines.map((l) => l.text);
    // Header: basename + per-file tallies.
    expect(texts[0]).toContain("a.json");
    expect(texts[0]).toContain("✓1");
    expect(texts[0]).toContain("✗1");
    expect(texts[0]).toContain("⊘1");
    // Success row shows idTag and transaction id.
    expect(texts[1]).toContain("s000");
    expect(texts[1]).toContain("c1");
    expect(texts[1]).toContain("RFID_TEST_1");
    expect(texts[1]).toContain("tx 1042");
    // Rejected row shows reason, then a failed-at line.
    expect(texts[2]).toContain("RFID_TEST_2");
    expect(texts[2]).toContain("id_tag_not_accepted");
    expect(texts[3]).toContain("at Authorize #2");
    // Truncated row labelled, with its captured tx id.
    expect(texts[4]).toContain("truncated");
    expect(texts[4]).toContain("tx 1043");
    expect(lines.length).toBe(5);
  });

  it("uses unique keys", () => {
    const lines = buildSummaryLines(results);
    expect(new Set(lines.map((l) => l.key)).size).toBe(lines.length);
  });
});

describe("SummaryScreen", () => {
  it("renders headline totals and the session list", async () => {
    const { lastFrame } = render(
      <SummaryScreen
        fileResults={results}
        files={[{ path: "/data/a.json", status: "failed" }]}
        width={80}
        height={12}
        interactive={false}
      />,
    );
    await flush();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("replay complete — exit 2");
    expect(frame).toContain("0 ok");
    expect(frame).toContain("1 failed of 1");
    expect(frame).toContain("4.0s");
    expect(frame).toContain("tx 1042");
    expect(frame).toContain("id_tag_not_accepted");
  });

  it("scrolls with the arrow keys and clamps at the end", async () => {
    // 1 header + 3 session lines + 1 failed-at line = 5 lines; with
    // height=HEADLINE_ROWS+2 only 2 list rows are visible at a time.
    const { lastFrame, stdin } = render(
      <SummaryScreen
        fileResults={results}
        files={[{ path: "/data/a.json", status: "failed" }]}
        width={80}
        height={6}
        interactive={true}
      />,
    );
    await flush();
    let frame = lastFrame() ?? "";
    expect(frame).toContain("a.json");
    expect(frame).not.toContain("tx 1043");
    // Overflow indicator with the visible window position.
    expect(frame).toContain("1–2/5");

    for (let i = 0; i < 10; i++) stdin.write("\x1b[B"); // down arrow
    await flush();
    frame = lastFrame() ?? "";
    // Clamped at the bottom: last two lines visible.
    expect(frame).toContain("4–5/5");
    expect(frame).toContain("tx 1043");

    stdin.write("\x1b[5~"); // PgUp jumps a full page back
    await flush();
    frame = lastFrame() ?? "";
    expect(frame).toContain("2–3/5");
  });

  it("always renders exactly `height` rows (overflow and underflow)", async () => {
    const files = [{ path: "/data/a.json", status: "failed" as const }];
    const overflow = render(
      <SummaryScreen
        fileResults={results}
        files={files}
        width={80}
        height={6}
        interactive={false}
      />,
    );
    await flush();
    expect((overflow.lastFrame() ?? "").split("\n").length).toBe(6);

    const underflow = render(
      <SummaryScreen
        fileResults={results}
        files={files}
        width={80}
        height={12}
        interactive={false}
      />,
    );
    await flush();
    expect((underflow.lastFrame() ?? "").split("\n").length).toBe(12);
  });
});
