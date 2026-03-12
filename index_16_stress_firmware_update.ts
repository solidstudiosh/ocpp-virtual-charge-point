require("dotenv").config();

import { registerVcp } from "./src/close";
import { logger } from "./src/logger";
import { OcppVersion } from "./src/ocppVersion";
import { delay } from "./src/utils";
import { bootNotificationOcppMessage } from "./src/v16/messages/bootNotification";
import { firmwareStatusNotificationOcppMessage } from "./src/v16/messages/firmwareStatusNotification";
import { statusNotificationOcppMessage } from "./src/v16/messages/statusNotification";
import { VCP } from "./src/vcp";

async function connectVcp(chargePointId: string): Promise<VCP> {
  const vcp = new VCP({
    endpoint: process.env.WS_URL ?? "ws://localhost:5555",
    chargePointId,
    ocppVersion: OcppVersion.OCPP_1_6,
    basicAuthPassword: process.env.PASSWORD ?? undefined,
  });
  vcp.postMessageAction("UpdateFirmware", async () => {
    logger.info("Updating firmware...");
    logger.info("Waiting for 2 seconds...");
    await delay(2000);
    logger.info("Sending firmware status notification...");
    vcp.send(
      firmwareStatusNotificationOcppMessage.request({
        status: "Installed",
      }),
    );
    logger.info("Firmware status notification sent");
  });
  vcp.connect().then(() => {
    vcp.send(
      bootNotificationOcppMessage.request({
        chargePointVendor: "Solidstudio",
        chargePointModel: "VirtualChargePoint",
        chargePointSerialNumber: "S001",
        firmwareVersion: "1.0.0",
      }),
    );
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: 1,
        errorCode: "NoError",
        status: "Available",
      }),
    );
  });
  return vcp;
}

(async () => {
  const chargePointsCount = Number.parseInt(process.env.CP_COUNT ?? "1000");
  for (let i = 1; i <= chargePointsCount; i++) {
    const chargePointIdPrefix = process.env.ID_PREFIX ?? "CS_1_";
    const chargePointId = `${chargePointIdPrefix}${i}`;
    const vcp = await connectVcp(chargePointId);
    registerVcp(vcp, () => connectVcp(chargePointId));
    await new Promise((r) => setTimeout(r, 100));
  }
})();

