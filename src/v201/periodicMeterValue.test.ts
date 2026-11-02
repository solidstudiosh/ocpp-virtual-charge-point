import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OcppCall } from "../ocppMessage";
import type { OcppMessageHandler } from "../ocppMessageHandler";
import { TransactionManager } from "../transactionManager";
import { messageHandlerV21 } from "../v21/messageHandler";
import type { VCP } from "../vcp";
import { messageHandlerV201 } from "./messageHandler";

interface SampledValue {
  value: number;
  unitOfMeasure?: { unit?: string };
}

interface TransactionEventPayload {
  eventType: string;
  meterValue?: { sampledValue: SampledValue[] }[];
}

type MeterValuesCallback = Parameters<
  TransactionManager["startTransaction"]
>[1]["meterValuesCallback"];

/** A VCP whose transaction manager hands out the periodic meter-value callback instead of timing it. */
const fakeVcp = () => {
  const sent: OcppCall[] = [];
  const periodic: MeterValuesCallback[] = [];
  const transactionManager = new TransactionManager();
  transactionManager.startTransaction = (_vcp, props) => {
    periodic.push(props.meterValuesCallback);
  };
  const vcp = {
    transactionManager,
    takeRemoteStartWithoutTransaction: () => false,
    respond: () => {},
    send: (call: OcppCall) => sent.push(call),
  };
  return { vcp: vcp as unknown as VCP, sent, periodic };
};

const transactionEvents = (sent: OcppCall[], eventType: string) =>
  sent
    .filter((call) => call.action === "TransactionEvent")
    .map((call) => call.payload as TransactionEventPayload)
    .filter((payload) => payload.eventType === eventType);

const remoteStart = async (handler: OcppMessageHandler, vcp: VCP) => {
  handler.handleCall(vcp, {
    messageId: "m1",
    action: "RequestStartTransaction",
    payload: { remoteStartId: 1, idToken: { idToken: "T", type: "ISO14443" } },
  });
  await Promise.resolve();
};

for (const [version, handler] of [
  ["2.0.1", messageHandlerV201],
  ["2.1", messageHandlerV21],
] as const) {
  describe(`OCPP ${version} periodic meter value`, () => {
    it("reports the energy charged so far in Wh", async () => {
      const { vcp, sent, periodic } = fakeVcp();
      await remoteStart(handler, vcp);

      await periodic[0]?.({
        transactionId: "t1",
        idTag: "T",
        connectorId: 1,
        startedAt: new Date(),
        meterValue: 150,
      });

      const [updated] = transactionEvents(sent, "Updated");
      const [sample] = updated?.meterValue?.[0]?.sampledValue ?? [];
      assert.equal(sample?.unitOfMeasure?.unit, "Wh");
      assert.equal(sample?.value, 150);
    });
  });
}
