import { describe, it, expect } from "vitest";
import { WebSocketServer } from "ws";
import { VCP } from "../vcp";
import { OcppVersion } from "../ocppVersion";
import { call } from "../messageFactory";

async function withFakeCpms(
  handler: (raw: string, send: (s: string) => void) => void,
  fn: (vcp: VCP) => Promise<void>,
) {
  const wss = new WebSocketServer({ port: 0 });
  const port = (wss.address() as { port: number }).port;
  wss.on("connection", (ws) => {
    ws.on("message", (data) => handler(data.toString(), (s) => ws.send(s)));
  });
  const vcp = new VCP({
    endpoint: `ws://localhost:${port}`,
    chargePointId: "TEST",
    ocppVersion: OcppVersion.OCPP_1_6,
  });
  await vcp.connect();
  try {
    await fn(vcp);
  } finally {
    vcp.close();
    wss.close();
  }
}

describe("VCP.sendAndAwait", () => {
  it("resolves with CallResult payload", async () => {
    await withFakeCpms(
      (raw, send) => {
        const [, msgId] = JSON.parse(raw);
        send(
          JSON.stringify([3, msgId, { currentTime: "2026-01-01T00:00:00Z" }]),
        );
      },
      async (vcp) => {
        const result = await vcp.sendAndAwait(call("Heartbeat", {}), {
          timeoutMs: 2000,
        });
        expect(result.currentTime).toBe("2026-01-01T00:00:00Z");
      },
    );
  });

  it("rejects with kind=CallError on type-4 frame", async () => {
    await withFakeCpms(
      (raw, send) => {
        const [, msgId] = JSON.parse(raw);
        send(JSON.stringify([4, msgId, "GenericError", "boom", {}]));
      },
      async (vcp) => {
        await expect(
          vcp.sendAndAwait(call("Heartbeat", {}), { timeoutMs: 2000 }),
        ).rejects.toMatchObject({ kind: "CallError", code: "GenericError" });
      },
    );
  });

  it("rejects with kind=Timeout when no response", async () => {
    await withFakeCpms(
      () => {
        /* never respond */
      },
      async (vcp) => {
        await expect(
          vcp.sendAndAwait(call("Heartbeat", {}), { timeoutMs: 200 }),
        ).rejects.toMatchObject({ kind: "Timeout" });
      },
    );
  });
});
