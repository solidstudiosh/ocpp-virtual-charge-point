import { describe, expect, it } from "vitest";
import { type TuiState, initialState, reduce } from "../state";

const ts = "2026-05-20T10:00:00.000Z";

describe("tui reducer", () => {
  it("starts empty", () => {
    expect(initialState.phase).toBe("idle");
    expect(initialState.sessions).toEqual([]);
    expect(initialState.succeeded).toBe(0);
    expect(initialState.rejected).toBe(0);
    expect(initialState.logs).toEqual([]);
  });

  it("run_start primes the run", () => {
    const s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S1",
      file: "/tmp/a.json",
      totalSessions: 3,
    });
    expect(s.phase).toBe("running");
    expect(s.stationId).toBe("S1");
    expect(s.file).toBe("/tmp/a.json");
    expect(s.sessions.length).toBe(3);
    expect(s.sessions.every((x) => x.status === "pending")).toBe(true);
  });

  it("session_start marks running and stores metadata", () => {
    let s: TuiState = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S1",
      file: "x.json",
      totalSessions: 2,
    });
    s = reduce(s, {
      type: "session_start",
      ts,
      sessionIndex: 0,
      connectorId: "1",
      idTag: "TAG",
      windowStart: ts,
    });
    expect(s.sessions[0].status).toBe("running");
    expect(s.sessions[0].connectorId).toBe("1");
    expect(s.sessions[0].idTag).toBe("TAG");
    expect(s.currentSessionIndex).toBe(0);
  });

  it("message_send updates current action", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S",
      file: "x",
      totalSessions: 1,
    });
    s = reduce(s, {
      type: "message_send",
      ts,
      sessionIndex: 0,
      messageIndex: 4,
      action: "MeterValues",
    });
    expect(s.currentAction).toBe("MeterValues");
    expect(s.messagesSent).toBe(1);
  });

  it("session_done increments succeeded and marks status", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S",
      file: "x",
      totalSessions: 1,
    });
    s = reduce(s, { type: "session_done", ts, sessionIndex: 0 });
    expect(s.succeeded).toBe(1);
    expect(s.sessions[0].status).toBe("done");
  });

  it("session_rejected increments rejected, stores reason", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S",
      file: "x",
      totalSessions: 1,
    });
    s = reduce(s, {
      type: "session_rejected",
      ts,
      sessionIndex: 0,
      reason: "timeout",
      details: {},
      failedAt: { action: "MeterValues", messageIndex: 2 },
    });
    expect(s.rejected).toBe(1);
    expect(s.sessions[0].status).toBe("rejected");
    expect(s.sessions[0].reason).toBe("timeout");
  });

  it("run_complete switches phase to complete and stores summary", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S",
      file: "x",
      totalSessions: 1,
    });
    s = reduce(s, {
      type: "run_complete",
      ts,
      summary: {
        ts,
        stationId: "S",
        sessionsTotal: 1,
        sessionsSucceeded: 1,
        sessionsRejected: 0,
        sessionsTruncated: 0,
        durationMs: 1234,
        durationIso: "PT1.234S",
        exitCode: 0,
      },
    });
    expect(s.phase).toBe("complete");
    expect(s.summary?.exitCode).toBe(0);
  });

  it("log keeps only the last 50 entries", () => {
    let s = initialState;
    for (let i = 0; i < 60; i++) {
      s = reduce(s, { type: "log", ts, level: "info", message: `m${i}` });
    }
    expect(s.logs.length).toBe(50);
    expect(s.logs[0].message).toBe("m10");
    expect(s.logs[49].message).toBe("m59");
  });

  it("session_truncated marks status truncated and bumps truncated counter", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S",
      file: "x",
      totalSessions: 1,
    });
    s = reduce(s, { type: "session_truncated", ts, sessionIndex: 0 });
    expect(s.sessions[0].status).toBe("truncated");
    expect(s.truncated).toBe(1);
    expect(s.succeeded).toBe(0);
    expect(s.rejected).toBe(0);
    expect(s.currentAction).toBeUndefined();
  });

  it("run_aborted flips phase to aborting", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S",
      file: "x",
      totalSessions: 1,
    });
    s = reduce(s, { type: "run_aborted", ts });
    expect(s.phase).toBe("aborting");
  });

  it("run_complete after run_aborted still finalizes to complete", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S",
      file: "x",
      totalSessions: 1,
    });
    s = reduce(s, { type: "run_aborted", ts });
    s = reduce(s, {
      type: "run_complete",
      ts,
      summary: {
        ts,
        stationId: "S",
        sessionsTotal: 0,
        sessionsSucceeded: 0,
        sessionsRejected: 0,
        sessionsTruncated: 0,
        durationMs: 1,
        durationIso: "PT0.001S",
        exitCode: 4,
      },
    });
    expect(s.phase).toBe("complete");
    expect(s.summary?.exitCode).toBe(4);
  });

  it("initialState has truncated=0", () => {
    expect(initialState.truncated).toBe(0);
  });

  it("run_start clears stale summary from a previous file in the batch", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S1",
      file: "a.json",
      totalSessions: 1,
    });
    s = reduce(s, {
      type: "run_complete",
      ts,
      summary: {
        ts,
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
    expect(s.summary).toBeDefined();
    s = reduce(s, {
      type: "run_start",
      ts,
      stationId: "S2",
      file: "b.json",
      totalSessions: 1,
    });
    // Summary from the previous file must not persist into the next file.
    expect(s.summary).toBeUndefined();
  });

  it("log entries get unique, monotonically increasing ids", () => {
    let s = initialState;
    for (let i = 0; i < 5; i++) {
      s = reduce(s, { type: "log", ts, level: "info", message: `m${i}` });
    }
    const ids = s.logs.map((l) => l.id);
    // Unique - safe as React keys.
    expect(new Set(ids).size).toBe(5);
    // Monotonically increasing.
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]);
    }
  });

  it("ids remain stable across trim when logs exceed MAX_LOGS", () => {
    let s = initialState;
    for (let i = 0; i < 60; i++) {
      s = reduce(s, { type: "log", ts, level: "info", message: `m${i}` });
    }
    // The oldest visible log keeps its original id even after trimming.
    expect(s.logs.length).toBe(50);
    expect(s.logs[0].message).toBe("m10");
    // The ids must still be strictly increasing - never reused.
    for (let i = 1; i < s.logs.length; i++) {
      expect(s.logs[i].id).toBeGreaterThan(s.logs[i - 1].id);
    }
  });

  it("run_start resets per-file successfulStarts counter", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S1",
      file: "a.json",
      totalSessions: 1,
    });
    s = reduce(s, {
      type: "session_start",
      ts,
      sessionIndex: 0,
      connectorId: "1",
      idTag: "T",
      windowStart: ts,
    });
    s = reduce(s, { type: "start_accepted", ts, sessionIndex: 0 });
    expect(s.successfulStarts).toBe(1);

    s = reduce(s, {
      type: "run_start",
      ts,
      stationId: "S2",
      file: "b.json",
      totalSessions: 1,
    });
    // successfulStarts must reset between files so per-file counts line up
    // with rejected/truncated in the StatusBar.
    expect(s.successfulStarts).toBe(0);
  });

  it("run_complete archives the file's sessions into fileResults", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S1",
      file: "a.json",
      totalSessions: 2,
    });
    s = reduce(s, {
      type: "session_start",
      ts,
      sessionIndex: 0,
      connectorId: "1",
      idTag: "RFID_TEST_1",
      windowStart: ts,
    });
    s = reduce(s, {
      type: "start_accepted",
      ts,
      sessionIndex: 0,
      transactionId: 1042,
    });
    s = reduce(s, { type: "session_done", ts, sessionIndex: 0 });
    s = reduce(s, {
      type: "session_start",
      ts,
      sessionIndex: 1,
      connectorId: "2",
      idTag: "RFID_TEST_2",
      windowStart: ts,
    });
    s = reduce(s, {
      type: "session_rejected",
      ts,
      sessionIndex: 1,
      reason: "id_tag_not_accepted",
      details: {},
      failedAt: { action: "Authorize", messageIndex: 0 },
    });
    const summary = {
      ts,
      stationId: "S1",
      sessionsTotal: 2,
      sessionsSucceeded: 1,
      sessionsRejected: 1,
      sessionsTruncated: 0,
      durationMs: 10,
      durationIso: "PT0.01S",
      exitCode: 2,
    };
    s = reduce(s, { type: "run_complete", ts, summary });

    expect(s.fileResults.length).toBe(1);
    expect(s.fileResults[0].file).toBe("a.json");
    expect(s.fileResults[0].stationId).toBe("S1");
    expect(s.fileResults[0].summary?.exitCode).toBe(2);
    expect(s.fileResults[0].sessions[0].txId).toBe(1042);
    expect(s.fileResults[0].sessions[1].reason).toBe("id_tag_not_accepted");
    expect(s.fileResults[0].sessions[1].failedAt).toEqual({
      action: "Authorize",
      messageIndex: 0,
    });

    // A second file appends rather than overwrites.
    s = reduce(s, {
      type: "run_start",
      ts,
      stationId: "S2",
      file: "b.json",
      totalSessions: 1,
    });
    s = reduce(s, { type: "session_truncated", ts, sessionIndex: 0 });
    s = reduce(s, {
      type: "run_complete",
      ts,
      summary: { ...summary, stationId: "S2", exitCode: 4 },
    });
    expect(s.fileResults.length).toBe(2);
    expect(s.fileResults[1].file).toBe("b.json");
    expect(s.fileResults[1].sessions[0].status).toBe("truncated");
  });

  it("batch_start clears fileResults and startedAt for a fresh round", () => {
    let s = reduce(initialState, {
      type: "run_start",
      ts,
      stationId: "S1",
      file: "a.json",
      totalSessions: 1,
    });
    s = reduce(s, {
      type: "run_complete",
      ts,
      summary: {
        ts,
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
    expect(s.fileResults.length).toBe(1);
    expect(s.startedAt).toBe(ts);

    s = reduce(s, {
      type: "batch_start",
      ts: "2026-05-20T11:00:00.000Z",
      totalFiles: 1,
      totalSessions: 1,
      totalMessages: 1,
    });
    expect(s.fileResults).toEqual([]);
    // startedAt must reset so the next round's elapsed clock starts fresh.
    expect(s.startedAt).toBeUndefined();

    const ts2 = "2026-05-20T11:00:01.000Z";
    s = reduce(s, {
      type: "run_start",
      ts: ts2,
      stationId: "S1",
      file: "a.json",
      totalSessions: 1,
    });
    expect(s.startedAt).toBe(ts2);
  });

  it("initialState has empty fileResults", () => {
    expect(initialState.fileResults).toEqual([]);
  });
});
