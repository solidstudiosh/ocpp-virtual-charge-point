import { describe, expect, it } from "vitest";
import { buildSummaryLines } from "../summaryLines";
import type { FileResult } from "../state";

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
