import { describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { call } from "../messageFactory";
import { OcppVersion } from "../ocppVersion";
import { VCP } from "../vcp";

type Frame = [number, string, string, Record<string, unknown>];

async function until(pred: () => boolean, ms = 3_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!pred()) {
    if (Date.now() > deadline) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function withFakeCpms(
  fn: (ctx: {
    vcp: VCP;
    received: Frame[];
    failMeterValues: { value: boolean };
  }) => Promise<void>,
) {
  const received: Frame[] = [];
  const failMeterValues = { value: true };
  const wss = new WebSocketServer({ port: 0 });
  const port = (wss.address() as { port: number }).port;
  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      const frame = JSON.parse(data.toString()) as Frame;
      received.push(frame);
      const [, msgId, action] = frame;
      if (action === "MeterValues" && failMeterValues.value) {
        ws.send(JSON.stringify([4, msgId, "GenericError", "cpms down", {}]));
      } else if (action === "StartTransaction") {
        ws.send(
          JSON.stringify([
            3,
            msgId,
            { idTagInfo: { status: "Accepted" }, transactionId: 7 },
          ]),
        );
      } else {
        ws.send(JSON.stringify([3, msgId, {}]));
      }
    });
  });
  const vcp = new VCP({
    endpoint: `ws://localhost:${port}`,
    chargePointId: "TEST",
    ocppVersion: OcppVersion.OCPP_1_6,
    transactionQueue: {
      scope: "connector",
      retryIntervalMs: 150,
      maxAttempts: 0,
      responseTimeoutMs: 5_000,
    },
  });
  await vcp.connect();
  try {
    await fn({ vcp, received, failMeterValues });
  } finally {
    vcp.close();
    wss.close();
  }
}

const mv = (connectorId: number, value: string) =>
  call("MeterValues", {
    connectorId,
    transactionId: 7,
    meterValue: [
      {
        timestamp: new Date().toISOString(),
        sampledValue: [{ value, measurand: "Energy.Active.Import.Register" }],
      },
    ],
  });

describe("VCP transaction message queue", () => {
  it("retries a CALLERRORed MeterValues with the same messageId, holds the connector's later samples, and drains in order once the CPMS recovers", async () => {
    await withFakeCpms(async ({ vcp, received, failMeterValues }) => {
      const first = mv(1, "1");
      const second = mv(1, "2");
      vcp.send(first);
      vcp.send(second);
      vcp.send(call("Heartbeat", {}));

      // two retries of the first sample happened; the second is still held
      await until(
        () => received.filter((f) => f[1] === first.messageId).length >= 3,
      );
      expect(received.some((f) => f[2] === "Heartbeat")).toBe(true);
      expect(received.some((f) => f[1] === second.messageId)).toBe(false);
      expect(vcp.transactionQueueSnapshot()?.queues[0]).toMatchObject({
        key: "connector:1",
        inFlight: { messageId: first.messageId },
        held: 1,
      });

      failMeterValues.value = false;
      await until(() => received.some((f) => f[1] === second.messageId));
      const meterValueIds = received
        .filter((f) => f[2] === "MeterValues")
        .map((f) => f[1]);
      expect(meterValueIds.at(-1)).toBe(second.messageId);
      expect(meterValueIds.indexOf(second.messageId)).toBeGreaterThan(
        meterValueIds.lastIndexOf(first.messageId),
      );
      await until(
        () => vcp.transactionQueueSnapshot()?.queues[0].delivered === 2,
      );
    });
  });

  it("lets another connector keep delivering while one connector is stuck", async () => {
    await withFakeCpms(async ({ vcp, received }) => {
      const stuck = mv(1, "1");
      vcp.send(stuck);
      await until(() => received.some((f) => f[1] === stuck.messageId));
      const other = call("StartTransaction", {
        connectorId: 2,
        idTag: "RFID_TEST_1",
        meterStart: 0,
        timestamp: new Date().toISOString(),
      });
      vcp.send(other);
      await until(() => received.some((f) => f[1] === other.messageId));
      expect(vcp.transactionQueueSnapshot()?.queues).toHaveLength(2);
    });
  });
});
