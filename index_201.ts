import * as uuid from "uuid";
require("dotenv").config();

const sleep = (delay: number) =>
    new Promise((resolve) => setTimeout(resolve, delay));

import { OcppVersion } from "./src/ocppVersion";
import { VCP } from "./src/vcp";

const vcp = new VCP({
  endpoint: process.env["WS_URL"] ?? "ws://localhost:3000",
  chargePointId: process.env["CP_ID"] ?? "123456",
  ocppVersion: OcppVersion.OCPP_2_0_1,
  basicAuthPassword: process.env["PASSWORD"] ?? undefined,
  adminWsPort: parseInt(process.env["ADMIN_WS_PORT"] ?? "9999"),
});

(async () => {
  await vcp.connect();
  await vcp.sendAndWait({
    messageId: uuid.v4(),
    action: "BootNotification",
    payload: {
      reason: "PowerUp",
      chargingStation: {
        model: "default model",
        vendorName: "EcoG",
        /*firmwareVersion: "1.0.1"*/
      },
    },
  });
  await sleep(500);
  await vcp.sendAndWait({
    messageId: uuid.v4(),
    action: "StatusNotification",
    payload: {
      connectorId: 1,
      evseId: 1,
      connectorStatus: "Occupied",
      timestamp: new Date(),
    },
  });
})();
