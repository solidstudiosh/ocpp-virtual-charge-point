import * as uuid from "uuid";
require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { VCP } from "./src/vcp";
import { getArgs } from './src/getArgs';
import { sleep } from "./src/utils"
import { bootVCP } from "./src/vcp_commands/bootVcp"

const args:Record<string, any> = getArgs();

const endpoint =
    args["ENV"]
        ? args["ENV"] === "local"
            ? "ws://127.0.0.1:9000"
            :
            args["ENV"] === "prod"
                ? "ws://ocpp.electricmiles.io"
                :
                `ws://ocpp.${args["ENV"]}.electricmiles.io`
        : args["WS_URL"] ?? process.env["WS_URL"] ?? "ws://ocpp.test.electricmiles.io";
import { simulateCharge } from "./src/simulateCharge";

const sleepTime: number = Number(args["SLEEP_TIME"] ?? process.env["SLEEP_TIME"] ?? 500);
const startChance: number = Number(args["START_CHANCE"] ?? process.env["START_CHANCE"] ?? 500);
const testCharge: boolean = args["TEST_CHARGE"] ?? process.env["TEST_CHARGE"] === "true" ?? false;
const duration: number = Number(args["DURATION"] ?? process.env["DURATION"] ?? 60000);
const isTwinGun: boolean = args["TWIN_GUN"] ?? process.env["TWIN_GUN"] === "true" ?? false;

const vcp = new VCP({
  endpoint: endpoint,
  chargePointId: args["CP_ID"] ?? process.env["CP_ID"] ?? "MY_CHARGER_SERIAL",
  ocppVersion: OcppVersion.OCPP_1_6,
  basicAuthPassword: process.env["PASSWORD"] ?? undefined,
  adminWsPort: parseInt(
      args["ADMIN_PORT"] ?? process.env["ADMIN_PORT"] ?? "9999"
  ),
});

(async () => {
  await vcp.connect();
  // boot twingun
  bootVCP(vcp, sleepTime);

  // if TEST_CHARGE=true set in cli, start test charge
  console.log(`Test charge set: ${testCharge}`);
  if (testCharge) {
    simulateCharge(vcp, duration, false);
  }
})();
