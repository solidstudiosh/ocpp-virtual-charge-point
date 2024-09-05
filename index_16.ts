import * as uuid from "uuid";
require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { VCP } from "./src/vcp";
import { getArgs } from './src/getArgs';

const args:Record<string, any> = getArgs();

const endpoint =
    args["ENV"]
    ? args["ENV"] === "local"
        ? "ws://localhost:9000"
        : `ws://ocpp.${args["ENV"]}.electricmiles.io`
    : args["WS_URL"] ?? process.env["WS_URL"] ?? "ws://ocpp.test.electricmiles.io";

const vcp = new VCP({
  endpoint: endpoint,
  chargePointId: args["CP_ID"] ?? process.env["CP_ID"] ?? "MY_CHARGER_SERIAL",
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
      chargePointVendor: "ATESS",
      chargePointModel: "EVA-07S-SE",
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
      status: "Preparing",
    },
  });
})();


