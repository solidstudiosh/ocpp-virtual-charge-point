require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { bootNotificationOcppMessage } from "./src/v21/messages/bootNotification";
import { statusNotificationOcppMessage } from "./src/v21/messages/statusNotification";
import { VCP } from "./src/vcp";

const vcp = new VCP({
  endpoint: process.env.WS_URL ?? "ws://localhost:3000",
  chargePointId: process.env.CP_ID ?? "123456",
  ocppVersion: OcppVersion.OCPP_2_1,
  basicAuthPassword: process.env.PASSWORD ?? undefined,
  adminWsPort: Number.parseInt(process.env.ADMIN_WS_PORT ?? "9999"),
});

(async () => {
  await vcp.connect();
  vcp.send(
    bootNotificationOcppMessage.request({
      reason: "PowerUp",
      chargingStation: {
        model: "VirtualChargePoint",
        vendorName: "Solidstudio",
      },
    }),
  );
  vcp.send(
    statusNotificationOcppMessage.request({
      evseId: 1,
      connectorId: 1,
      connectorStatus: "Available",
      timestamp: new Date().toISOString(),
    }),
  );
})();
