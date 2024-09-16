import * as uuid from "uuid";
require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { VCP } from "./src/vcp";
import { getArgs } from './src/getArgs';

const args:Record<string, any> = getArgs();

const endpoint =
    args["ENV"]
    ? args["ENV"] === "local"
        ? "ws://127.0.0.1:9000"
        : `ws://ocpp.${args["ENV"]}.electricmiles.io`
    : args["WS_URL"] ?? process.env["WS_URL"] ?? "ws://ocpp.test.electricmiles.io";
import { simulateCharge } from "./src/simulateCharge";

const sleep = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay));

const startChance: number = Number(args["START_CHANCE"] ?? process.env["START_CHANCE"] ?? 500);
const testCharge: boolean = args["TEST_CHARGE"] ?? process.env["TEST_CHARGE"] === "true" ?? false;
const duration: number = Number(args["DURATION"] ?? process.env["DURATION"] ?? 60000);

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
  await vcp.sendAndWait({
    messageId: uuid.v4(),
    action: "BootNotification",
    payload: {
      chargePointVendor: "ATESS",
      chargePointModel: "EVA-07S-SE",
      chargePointSerialNumber: "EM_VCP_TEST",
      firmwareVersion: "V501.030.04",
    },
  });
  await sleep(500);
  await vcp.sendAndWait({
    messageId: uuid.v4(),
    action: "StatusNotification",
    payload: {
      connectorId: 1,
      errorCode: "NoError",
      status: "Preparing",
    },
  });
  // if TEST_CHARGE=true set in cli, start test charge
  console.log(`Test charge set: ${testCharge}`);
  if (testCharge) {
    simulateCharge(vcp, duration, false);
  }
})();
