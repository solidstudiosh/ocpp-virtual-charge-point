import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OcppCall, OcppCallResult } from "../ocppMessage";
import { TransactionManager } from "../transactionManager";
import type { VCP } from "../vcp";
import { messageHandlerV12 } from "./messageHandler";

/** Records what a handler made the VCP do, in order. */
const fakeVcp = () => {
  const events: string[] = [];
  const vcp = {
    transactionManager: new TransactionManager(),
    respond: (result: OcppCallResult) =>
      events.push(`respond ${JSON.stringify(result.payload)}`),
    send: (call: OcppCall) =>
      events.push(`send ${call.action} ${JSON.stringify(call.payload)}`),
    configureHeartbeat: (ms: number) => events.push(`heartbeat ${ms}`),
  };
  return { vcp: vcp as unknown as VCP, events, raw: vcp };
};

const handle = async (vcp: VCP, action: string, payload: object) => {
  messageHandlerV12.handleCall(vcp, { messageId: "m1", action, payload });
  await new Promise((resolve) => setImmediate(resolve));
};

const strip = (events: string[]) =>
  events.map((e) => e.replace(/"timestamp":"[^"]+"/g, '"timestamp":"T"'));

describe("OCPP 1.2 message handlers", () => {
  it("RemoteStart answers first, then Occupied, then StartTransaction", async () => {
    const { vcp, events } = fakeVcp();
    await handle(vcp, "RemoteStartTransaction", { idTag: "T", connectorId: 2 });
    assert.deepEqual(strip(events), [
      'respond {"status":"Accepted"}',
      'send StatusNotification {"connectorId":2,"status":"Occupied","errorCode":"NoError"}',
      'send StartTransaction {"connectorId":2,"idTag":"T","timestamp":"T","meterStart":0}',
    ]);
  });

  it("RemoteStart without connectorId is rejected unless a fixed connector is configured", async () => {
    const { vcp, events } = fakeVcp();
    const previous = process.env.CONNECTORLESS_FLOW_CONNECTOR_ID;
    Reflect.deleteProperty(process.env, "CONNECTORLESS_FLOW_CONNECTOR_ID");
    await handle(vcp, "RemoteStartTransaction", { idTag: "T" });
    process.env.CONNECTORLESS_FLOW_CONNECTOR_ID = "1";
    await handle(vcp, "RemoteStartTransaction", { idTag: "T" });
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "CONNECTORLESS_FLOW_CONNECTOR_ID");
    } else {
      process.env.CONNECTORLESS_FLOW_CONNECTOR_ID = previous;
    }
    assert.equal(events[0], 'respond {"status":"Rejected"}');
    assert.equal(events[1], 'respond {"status":"Accepted"}');
    assert.match(events[3], /^send StartTransaction \{"connectorId":1,/);
  });

  it("RemoteStop sends StopTransaction with the meter in Wh, then Available", async () => {
    const { vcp, events, raw } = fakeVcp();
    raw.transactionManager.transactions.set(7, {
      transactionId: 7,
      idTag: "T",
      connectorId: 1,
      meterValue: 0,
      startedAt: new Date(Date.now() - 10_000),
    });
    await handle(vcp, "RemoteStopTransaction", { transactionId: 7 });
    assert.equal(events[0], 'respond {"status":"Accepted"}');
    assert.match(
      events[1],
      /^send StopTransaction \{"transactionId":7,"idTag":"T","timestamp":"[^"]+","meterStop":\d{3}\}$/,
    );
    assert.equal(
      events[2],
      'send StatusNotification {"connectorId":1,"status":"Available","errorCode":"NoError"}',
    );
  });

  it("ChangeConfiguration HeartBeatInterval re-arms the heartbeat; a bad value is rejected", async () => {
    const { vcp, events } = fakeVcp();
    await handle(vcp, "ChangeConfiguration", {
      key: "HeartBeatInterval",
      value: "45",
    });
    await handle(vcp, "ChangeConfiguration", {
      key: "HeartBeatInterval",
      value: "x",
    });
    await handle(vcp, "ChangeConfiguration", { key: "Other", value: "1" });
    assert.deepEqual(events, [
      'respond {"status":"Accepted"}',
      "heartbeat 45000",
      'respond {"status":"Rejected"}',
      'respond {"status":"Accepted"}',
    ]);
  });

  it("ChangeAvailability Operative keeps a charging connector Occupied", async () => {
    const { vcp, events, raw } = fakeVcp();
    raw.transactionManager.transactions.set(7, {
      transactionId: 7,
      idTag: "T",
      connectorId: 1,
      meterValue: 0,
      startedAt: new Date(),
    });
    await handle(vcp, "ChangeAvailability", {
      connectorId: 1,
      type: "Operative",
    });
    assert.deepEqual(events, [
      'respond {"status":"Accepted"}',
      'send StatusNotification {"connectorId":1,"status":"Occupied","errorCode":"NoError"}',
    ]);
  });
});
