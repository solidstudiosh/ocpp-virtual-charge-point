require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { registerVcp } from "./src/close";
import { bootNotificationOcppOutgoing } from "./src/v21/messages/bootNotification";
import { statusNotificationOcppOutgoing } from "./src/v21/messages/statusNotification";
import { VCP } from "./src/vcp";

async function main(): Promise<VCP> {
  const evses = Number.parseInt(process.env.EVSES ?? "1");
  const connectors = Number.parseInt(process.env.CONNECTORS ?? "1");
  const vcp = new VCP({
    endpoint: process.env.WS_URL ?? "ws://localhost:3000",
    chargePointId: process.env.CP_ID ?? "123456",
    ocppVersion: OcppVersion.OCPP_2_1,
    basicAuthPassword: process.env.PASSWORD ?? undefined,
    adminPort: Number.parseInt(process.env.ADMIN_PORT ?? "9999"),
  });
  await vcp.connect();
  vcp.send(
    bootNotificationOcppOutgoing.request({
      reason: "PowerUp",
      chargingStation: {
        model: "VirtualChargePoint",
        vendorName: "Solidstudio",
      },
    }),
  );
  for (let evseId = 1; evseId <= evses; evseId++) {
    for (let connectorId = 1; connectorId <= connectors; connectorId++) {
      vcp.send(
        statusNotificationOcppOutgoing.request({
          evseId,
          connectorId,
          connectorStatus: "Available",
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
  return vcp;
}

main().then((vcp) => registerVcp(vcp, main));
