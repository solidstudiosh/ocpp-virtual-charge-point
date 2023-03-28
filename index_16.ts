import * as uuid from "uuid";
require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { VCP } from "./src/vcp";

const vcp = new VCP({
  endpoint: process.env["WS_URL"] ?? "ws://localhost:3000",
  chargePointId: process.env["CP_ID"] ?? "123456",
  ocppVersion: OcppVersion.OCPP_1_6,
  basicAuthPassword: process.env["PASSWORD"] ?? undefined,
  adminWsPort: parseInt(
    process.env["ADMIN_PORT"] ?? "9999"
  ),
});

(async () => {
  await vcp.connect();
  vcp.send({
    messageId: uuid.v4(),
    action: "BootNotification",
    payload: {
      chargePointVendor: "Solidstudio",
      chargePointModel: "VirtualChargePoint",
      chargePointSerialNumber: "S001",
      firmwareVersion: "1.0.0",
    },
  });
  vcp.send({
    messageId: uuid.v4(),
    action: "StatusNotification",
    payload: {
      connectorId: 1,
      errorCode: "NoError",
      status: "Available",
    },
  });
})();
