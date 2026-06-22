import { describe, expect, it } from "vitest";
import {
  buildReplayFile,
  isRawOcppLog,
  parseRawLog,
  type RawLogEntry,
} from "../logConvert";

/** Builds one raw-log entry; payload is JSON-encoded like the real export. */
// biome-ignore lint/suspicious/noExportsInTest: reused by later tasks
export function entry(timestamp: string, frame: unknown): RawLogEntry {
  return { timestamp, payload: JSON.stringify(frame) };
}

/**
 * Synthetic remote-start session mirroring the system's export shape:
 * newest-first, responses interleaved, one server-originated call, a
 * StopTransaction with an epoch-zero body timestamp, and a trailing
 * Preparing that belongs to no transaction.
 */
// biome-ignore lint/suspicious/noExportsInTest: reused by later tasks
export const SAMPLE: RawLogEntry[] = [
  entry("2026-06-03T07:52:25+02:00", [3, "2756", {}]),
  entry("2026-06-03T07:52:25+02:00", [
    2,
    "2756",
    "StatusNotification",
    { connectorId: 2, errorCode: "NoError", status: "Preparing" },
  ]),
  entry("2026-06-03T07:52:23+02:00", [
    3,
    "2755",
    { idTagInfo: { status: "Accepted" } },
  ]),
  entry("2026-06-03T07:52:23+02:00", [
    2,
    "2755",
    "StopTransaction",
    {
      idTag: "RFID_TEST_1",
      meterStop: 0,
      reason: "Local",
      timestamp: "1970-01-01T00:00:00.000Z",
      transactionId: 1001,
    },
  ]),
  entry("2026-06-03T07:52:21+02:00", [3, "2754", {}]),
  entry("2026-06-03T07:52:21+02:00", [
    2,
    "2754",
    "StatusNotification",
    { connectorId: 2, errorCode: "NoError", status: "Available" },
  ]),
  entry("2026-06-03T07:52:20+02:00", [
    3,
    "2753",
    { idTagInfo: { status: "Accepted" }, transactionId: 1001 },
  ]),
  entry("2026-06-03T07:52:19+02:00", [
    2,
    "2753",
    "StartTransaction",
    {
      connectorId: 2,
      idTag: "RFID_TEST_1",
      meterStart: 0,
      reservationId: 0,
      timestamp: "2026-06-03T05:52:19.474Z",
    },
  ]),
  entry("2026-06-03T07:52:18+02:00", [3, "b3c1afa0", { status: "Accepted" }]),
  entry("2026-06-03T07:52:18+02:00", [
    2,
    "b3c1afa0",
    "RemoteStartTransaction",
    { connectorId: 2, idTag: "RFID_TEST_1" },
  ]),
  entry("2026-06-03T07:52:17+02:00", [
    3,
    "2752",
    { currentTime: "2026-06-03T05:52:17.820Z" },
  ]),
  entry("2026-06-03T07:52:17+02:00", [2, "2752", "Heartbeat", {}]),
];

describe("isRawOcppLog", () => {
  it("accepts an array of {timestamp, payload} string pairs", () => {
    expect(isRawOcppLog(SAMPLE)).toBe(true);
  });

  it("rejects scenario files, non-arrays, empty arrays, and bad entries", () => {
    expect(isRawOcppLog({ stationId: "CS_TEST_1", sessions: [] })).toBe(false);
    expect(isRawOcppLog("[]")).toBe(false);
    expect(isRawOcppLog([])).toBe(false);
    expect(isRawOcppLog([{ timestamp: "x" }])).toBe(false);
    expect(isRawOcppLog([{ timestamp: 1, payload: "[]" }])).toBe(false);
  });
});

describe("parseRawLog", () => {
  it("keeps only allowed CALL frames and counts the rest", () => {
    const parsed = parseRawLog(SAMPLE);
    expect(parsed.stats.totalEntries).toBe(12);
    // Heartbeat, StartTransaction, SN(Available), StopTransaction, SN(Preparing)
    expect(parsed.stats.keptCalls).toBe(5);
    // 6 responses + 1 RemoteStartTransaction
    expect(parsed.stats.droppedFrames).toBe(7);
    expect(parsed.stats.corruptEntries).toBe(0);
  });

  it("orders frames chronologically (input is newest-first)", () => {
    const kept = parseRawLog(SAMPLE).frames.filter((f) => f.kept);
    expect(kept.map((f) => f.action)).toEqual([
      "Heartbeat",
      "StartTransaction",
      "StatusNotification",
      "StopTransaction",
      "StatusNotification",
    ]);
  });

  it("normalizes envelope timestamps to UTC ISO with milliseconds", () => {
    const kept = parseRawLog(SAMPLE).frames.filter((f) => f.kept);
    expect(kept[0].envelopeIso).toBe("2026-06-03T05:52:17.000Z");
    expect(kept[3].envelopeIso).toBe("2026-06-03T05:52:23.000Z");
  });

  it("retains dropped-by-action frames as unkept idTag donors", () => {
    const remote = parseRawLog(SAMPLE).frames.find(
      (f) => f.action === "RemoteStartTransaction",
    );
    expect(remote).toBeDefined();
    expect(remote?.kept).toBe(false);
  });

  it("preserves intra-second order of same-timestamp calls", () => {
    // Newest-first export: mv2 listed before mv1 within the same second.
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "11",
        "MeterValues",
        { connectorId: 1, marker: "mv2" },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "10",
        "MeterValues",
        { connectorId: 1, marker: "mv1" },
      ]),
    ];
    const frames = parseRawLog(log).frames;
    expect(frames.map((f) => f.body.marker)).toEqual(["mv1", "mv2"]);
  });

  it("skips and counts unparseable payloads and malformed frames", () => {
    const log: RawLogEntry[] = [
      { timestamp: "2026-06-03T08:00:00+02:00", payload: "not json {" },
      entry("2026-06-03T08:00:01+02:00", { not: "an array" }),
      entry("2026-06-03T08:00:02+02:00", [2, 99, "Heartbeat", {}]),
      entry("2026-06-03T08:00:03+02:00", [2, "1", "Heartbeat", {}]),
    ];
    const parsed = parseRawLog(log);
    expect(parsed.stats.corruptEntries).toBe(3);
    expect(parsed.stats.keptCalls).toBe(1);
  });

  it("keeps frames with unparseable envelope timestamps, marked undefined", () => {
    const log: RawLogEntry[] = [
      entry("garbage-date", [2, "1", "Heartbeat", {}]),
      entry("2026-06-03T08:00:00+02:00", [2, "2", "Heartbeat", {}]),
    ];
    const frames = parseRawLog(log).frames;
    const bad = frames.find((f) => f.messageId === "1");
    expect(bad?.envelopeMs).toBeUndefined();
    expect(bad?.envelopeIso).toBe("garbage-date");
  });
});

const NOW = new Date("2026-06-11T12:00:00.000Z");
const NO_REBASE = { stationId: "CS_TEST_1", rebaseTimestamps: false, now: NOW };

describe("buildReplayFile — session splitting", () => {
  it("builds one session per StartTransaction, keeping trailing frames", () => {
    const file = buildReplayFile(parseRawLog(SAMPLE), NO_REBASE);
    expect(file.stationId).toBe("CS_TEST_1");
    expect(file.sessions).toHaveLength(1);
    // Trailing SN(Preparing) after the Stop is attached to the session it
    // followed rather than discarded.
    expect(file.sessions[0].messages.map((m) => m.action)).toEqual([
      "Heartbeat",
      "StartTransaction",
      "StatusNotification",
      "StopTransaction",
      "StatusNotification",
    ]);
  });

  it("keeps the endSignal/window anchored on the Stop despite trailing frames", () => {
    const s = buildReplayFile(parseRawLog(SAMPLE), NO_REBASE).sessions[0];
    // The trailing SN(Preparing) at 05:52:25 must not move the session end.
    expect(s.endSignal).toEqual({
      kind: "StopTransaction",
      timestamp: "2026-06-03T05:52:23.000Z",
    });
    expect(s.windowEnd).toBe("2026-06-03T05:52:23.000Z");
    // …but it is the last emitted message, carrying its own envelope time.
    const msgs = s.messages;
    const trailing = msgs[msgs.length - 1];
    expect(trailing.action).toBe("StatusNotification");
    expect(trailing.timestamp).toBe("2026-06-03T05:52:25.000Z");
    expect(trailing.body.status).toBe("Preparing");
  });

  it("fills session fields from the StartTransaction and window edges", () => {
    const s = buildReplayFile(parseRawLog(SAMPLE), NO_REBASE).sessions[0];
    expect(s.connectorId).toBe("2");
    expect(s.idTag).toBe("RFID_TEST_1");
    // First kept frame is a Heartbeat, not a StatusNotification.
    expect(s.startSignal).toEqual({
      kind: "StartTransaction",
      timestamp: "2026-06-03T05:52:17.000Z",
    });
    expect(s.endSignal).toEqual({
      kind: "StopTransaction",
      timestamp: "2026-06-03T05:52:23.000Z",
    });
    expect(s.windowStart).toBe(s.startSignal.timestamp);
    expect(s.windowEnd).toBe(s.endSignal.timestamp);
  });

  it("maps messages with sequential ids and body-derived idTags", () => {
    const msgs = buildReplayFile(parseRawLog(SAMPLE), NO_REBASE).sessions[0]
      .messages;
    // Ids stay continuous through the appended trailing frame.
    expect(msgs.map((m) => m.id)).toEqual(["1", "2", "3", "4", "5"]);
    expect(msgs.every((m) => m.messageType === "2")).toBe(true);
    expect(msgs[1].messageId).toBe("2753");
    expect(msgs[1].idTag).toBe("RFID_TEST_1");
    expect(msgs[0].idTag).toBe(""); // Heartbeat body has no idTag
    expect(msgs[3].body.transactionId).toBe(1001);
  });

  it("uses a StatusNotification status as startSignal.kind when first", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:02+02:00", [
        2,
        "3",
        "StopTransaction",
        { idTag: "RFID_TEST_1", meterStop: 5, transactionId: 1 },
      ]),
      entry("2026-06-03T08:00:01+02:00", [
        2,
        "2",
        "StartTransaction",
        { connectorId: 1, idTag: "RFID_TEST_1", meterStart: 0 },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StatusNotification",
        { connectorId: 1, errorCode: "NoError", status: "Preparing" },
      ]),
    ];
    const s = buildReplayFile(parseRawLog(log), NO_REBASE).sessions[0];
    expect(s.startSignal.kind).toBe("Preparing");
  });

  it("falls back to a dropped frame's idTag when StartTransaction has none", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:02+02:00", [
        2,
        "3",
        "StopTransaction",
        { meterStop: 5, transactionId: 1 },
      ]),
      entry("2026-06-03T08:00:01+02:00", [
        2,
        "2",
        "StartTransaction",
        { connectorId: 1, meterStart: 0 },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "RemoteStartTransaction",
        { connectorId: 1, idTag: "RFID_TEST_2" },
      ]),
    ];
    const s = buildReplayFile(parseRawLog(log), NO_REBASE).sessions[0];
    expect(s.idTag).toBe("RFID_TEST_2");
  });

  it("is empty-string idTag when no frame carries one", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:01+02:00", [
        2,
        "2",
        "StopTransaction",
        { meterStop: 5, transactionId: 1 },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StartTransaction",
        { connectorId: 1, meterStart: 0 },
      ]),
    ];
    const s = buildReplayFile(parseRawLog(log), NO_REBASE).sessions[0];
    expect(s.idTag).toBe("");
  });

  it("splits multiple transactions into multiple sessions, ids continuous", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:03+02:00", [
        2,
        "4",
        "StopTransaction",
        { idTag: "RFID_TEST_2", meterStop: 9, transactionId: 2 },
      ]),
      entry("2026-06-03T08:00:02+02:00", [
        2,
        "3",
        "StartTransaction",
        { connectorId: 2, idTag: "RFID_TEST_2", meterStart: 0 },
      ]),
      entry("2026-06-03T08:00:01+02:00", [
        2,
        "2",
        "StopTransaction",
        { idTag: "RFID_TEST_1", meterStop: 5, transactionId: 1 },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StartTransaction",
        { connectorId: 1, idTag: "RFID_TEST_1", meterStart: 0 },
      ]),
    ];
    const file = buildReplayFile(parseRawLog(log), NO_REBASE);
    expect(file.sessions).toHaveLength(2);
    expect(file.sessions[0].idTag).toBe("RFID_TEST_1");
    expect(file.sessions[1].idTag).toBe("RFID_TEST_2");
    expect(file.sessions[0].messages.map((m) => m.id)).toEqual(["1", "2"]);
    expect(file.sessions[1].messages.map((m) => m.id)).toEqual(["3", "4"]);
  });

  it("closes a stopless session at end-of-file with EndOfData", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:05:00+02:00", [
        2,
        "2",
        "MeterValues",
        { connectorId: 1, meterValue: [] },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StartTransaction",
        { connectorId: 1, idTag: "RFID_TEST_1", meterStart: 0 },
      ]),
    ];
    const s = buildReplayFile(parseRawLog(log), NO_REBASE).sessions[0];
    expect(s.endSignal).toEqual({
      kind: "EndOfData",
      timestamp: "2026-06-03T06:05:00.000Z",
    });
  });

  it("yields zero sessions when there is no StartTransaction", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StatusNotification",
        { connectorId: 1, errorCode: "NoError", status: "Available" },
      ]),
    ];
    expect(buildReplayFile(parseRawLog(log), NO_REBASE).sessions).toEqual([]);
  });

  it("includes password only when provided", () => {
    const parsed = parseRawLog(SAMPLE);
    const withPw = buildReplayFile(parsed, { ...NO_REBASE, password: "pw1" });
    expect(withPw.password).toBe("pw1");
    const without = buildReplayFile(parsed, NO_REBASE);
    expect("password" in without).toBe(false);
  });
});

describe("parseRawLog — sessionCount", () => {
  it("counts partitions that contain a StartTransaction", () => {
    expect(parseRawLog(SAMPLE).sessionCount).toBe(1);
  });
});

describe("buildReplayFile — timestamp rebasing", () => {
  const REBASE = { stationId: "CS_TEST_1", rebaseTimestamps: true, now: NOW };

  it("anchors the last StopTransaction envelope at now, preserving spacing", () => {
    const s = buildReplayFile(parseRawLog(SAMPLE), REBASE).sessions[0];
    const byAction = Object.fromEntries(
      s.messages.map((m) => [m.action, m] as const),
    );
    // Stop envelope was 05:52:23.000Z → maps exactly to NOW.
    expect(byAction.StopTransaction.timestamp).toBe("2026-06-11T12:00:00.000Z");
    // Heartbeat was 6s before the Stop.
    expect(byAction.Heartbeat.timestamp).toBe("2026-06-11T11:59:54.000Z");
    expect(s.windowEnd).toBe("2026-06-11T12:00:00.000Z");
    expect(s.endSignal.timestamp).toBe("2026-06-11T12:00:00.000Z");
  });

  it("shifts valid body timestamps by the same delta", () => {
    const s = buildReplayFile(parseRawLog(SAMPLE), REBASE).sessions[0];
    const start = s.messages.find((m) => m.action === "StartTransaction");
    // Body ts 05:52:19.474Z is 3.526s before the anchor.
    expect(start?.body.timestamp).toBe("2026-06-11T11:59:56.474Z");
  });

  it("leaves epoch-zero body timestamps verbatim", () => {
    const s = buildReplayFile(parseRawLog(SAMPLE), REBASE).sessions[0];
    const stop = s.messages.find((m) => m.action === "StopTransaction");
    expect(stop?.body.timestamp).toBe("1970-01-01T00:00:00.000Z");
  });

  it("shifts meterValue sample timestamps", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:10+02:00", [
        2,
        "3",
        "StopTransaction",
        { idTag: "RFID_TEST_1", meterStop: 5, transactionId: 1 },
      ]),
      entry("2026-06-03T08:00:05+02:00", [
        2,
        "2",
        "MeterValues",
        {
          connectorId: 1,
          meterValue: [
            {
              timestamp: "2026-06-03T06:00:05.000Z",
              sampledValue: [{ value: "1.0", unit: "kWh" }],
            },
          ],
        },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StartTransaction",
        { connectorId: 1, idTag: "RFID_TEST_1", meterStart: 0 },
      ]),
    ];
    const s = buildReplayFile(parseRawLog(log), REBASE).sessions[0];
    const mv = s.messages.find((m) => m.action === "MeterValues");
    // Anchor (Stop, 06:00:10Z) → NOW; the sample is 5s earlier.
    expect(mv?.body.meterValue[0].timestamp).toBe("2026-06-11T11:59:55.000Z");
  });

  it("anchors on the last message when there is no StopTransaction", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:05:00+02:00", [
        2,
        "2",
        "MeterValues",
        { connectorId: 1, meterValue: [] },
      ]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StartTransaction",
        { connectorId: 1, idTag: "RFID_TEST_1", meterStart: 0 },
      ]),
    ];
    const s = buildReplayFile(parseRawLog(log), REBASE).sessions[0];
    expect(s.windowEnd).toBe("2026-06-11T12:00:00.000Z");
    expect(s.windowStart).toBe("2026-06-11T11:55:00.000Z");
  });

  it("leaves frames with unparseable envelopes untouched", () => {
    const log: RawLogEntry[] = [
      entry("2026-06-03T08:00:01+02:00", [
        2,
        "3",
        "StopTransaction",
        { idTag: "RFID_TEST_1", meterStop: 5, transactionId: 1 },
      ]),
      entry("garbage-date", [2, "2", "Heartbeat", {}]),
      entry("2026-06-03T08:00:00+02:00", [
        2,
        "1",
        "StartTransaction",
        { connectorId: 1, idTag: "RFID_TEST_1", meterStart: 0 },
      ]),
    ];
    const s = buildReplayFile(parseRawLog(log), REBASE).sessions[0];
    const hb = s.messages.find((m) => m.action === "Heartbeat");
    expect(hb?.timestamp).toBe("garbage-date");
  });
});
