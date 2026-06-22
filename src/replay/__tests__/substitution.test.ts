import { describe, expect, it } from "vitest";
import {
  applySubstitutions,
  extractEnergyWh,
  synthesizeStopTransaction,
} from "../substitution";
import type { ReplaySession, SessionContext } from "../types";

const ctx = (): SessionContext => ({ connectorId: 1, idTag: "T" });

describe("applySubstitutions", () => {
  it("replaces -1 transactionId on MeterValues with capturedTxId", () => {
    const c = ctx();
    c.capturedTxId = 42;
    const body = { connectorId: 1, transactionId: -1, meterValue: [] };
    const out = applySubstitutions("MeterValues", body, c);
    expect(out.transactionId).toBe(42);
  });

  it("replaces missing transactionId on StopTransaction with capturedTxId", () => {
    const c = ctx();
    c.capturedTxId = 99;
    const body = { meterStop: 100, timestamp: "t", idTag: "T" };
    const out = applySubstitutions("StopTransaction", body, c);
    expect(out.transactionId).toBe(99);
  });

  it("overrides a positive recorded transactionId on MeterValues with capturedTxId", () => {
    // Real converted logs carry the original positive txId; the replay must
    // pose as a new transaction and use the captured one instead.
    const c = ctx();
    c.capturedTxId = 42;
    const body = { connectorId: 1, transactionId: 7, meterValue: [] };
    const out = applySubstitutions("MeterValues", body, c);
    expect(out.transactionId).toBe(42);
  });

  it("overrides a positive recorded transactionId on StopTransaction with capturedTxId", () => {
    const c = ctx();
    c.capturedTxId = 99;
    const body = { transactionId: 557850982, meterStop: 100, idTag: "T" };
    const out = applySubstitutions("StopTransaction", body, c);
    expect(out.transactionId).toBe(99);
  });

  it("leaves the recorded transactionId untouched when no capturedTxId is available", () => {
    const c = ctx(); // no StartTransaction captured this session
    const body = { connectorId: 1, transactionId: 7, meterValue: [] };
    const out = applySubstitutions("MeterValues", body, c);
    expect(out.transactionId).toBe(7);
  });

  it("returns a copy, not the original body", () => {
    const c = ctx();
    c.capturedTxId = 5;
    const body = { transactionId: -1 };
    const out = applySubstitutions("MeterValues", body, c);
    expect(out).not.toBe(body);
    expect(body.transactionId).toBe(-1);
  });

  it("identity passthrough for non-tx actions", () => {
    const body = { status: "Preparing", connectorId: 1, errorCode: "NoError" };
    const out = applySubstitutions("StatusNotification", body, ctx());
    expect(out).toEqual(body);
  });
});

describe("extractEnergyWh", () => {
  it("returns largest Energy.Active.Import.Register Wh sample", () => {
    const body = {
      meterValue: [
        {
          timestamp: "t",
          sampledValue: [
            {
              value: "100",
              measurand: "Energy.Active.Import.Register",
              unit: "Wh",
            },
            { value: "0", measurand: "Power.Active.Import", unit: "W" },
          ],
        },
        {
          timestamp: "t2",
          sampledValue: [
            {
              value: "350",
              measurand: "Energy.Active.Import.Register",
              unit: "Wh",
            },
          ],
        },
      ],
    };
    expect(extractEnergyWh(body)).toBe(350);
  });

  it("returns undefined when no energy sample present", () => {
    expect(extractEnergyWh({ meterValue: [] })).toBeUndefined();
  });
});

const session = (): ReplaySession => ({
  connectorId: "1",
  startSignal: { kind: "Preparing", timestamp: "2026-02-05T11:07:37Z" },
  endSignal: { kind: "Finishing", timestamp: "2026-02-05T11:22:38Z" },
  idTag: "T",
  windowStart: "2026-02-05T11:07:37Z",
  windowEnd: "2026-02-05T11:22:38Z",
  messages: [],
});

describe("synthesizeStopTransaction", () => {
  it("uses lastEnergyWh as meterStop when present", () => {
    const body = synthesizeStopTransaction(session(), {
      connectorId: 1,
      idTag: "T",
      capturedTxId: 7,
      lastEnergyWh: 4500,
      meterStartWh: 1000,
    });
    expect(body).toEqual({
      transactionId: 7,
      timestamp: "2026-02-05T11:22:38Z",
      meterStop: 4500,
      idTag: "T",
      reason: "Local",
    });
  });

  it("falls back to meterStartWh when no MV energy seen", () => {
    const body = synthesizeStopTransaction(session(), {
      connectorId: 1,
      idTag: "T",
      capturedTxId: 7,
      meterStartWh: 1000,
    });
    expect(body.meterStop).toBe(1000);
  });

  it("returns undefined if capturedTxId is missing", () => {
    const body = synthesizeStopTransaction(session(), {
      connectorId: 1,
      idTag: "T",
    });
    expect(body).toBeUndefined();
  });
});
