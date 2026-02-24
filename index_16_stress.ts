require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { bootNotificationOcppMessage } from "./src/v16/messages/bootNotification";
import { startTransactionOcppMessage } from "./src/v16/messages/startTransaction";
import { VCP } from "./src/vcp";

/**
 * Run CP_COUNT(defaults to 1000) simultaneous VCPs that connect to given websocket (WS_URL).
 * Each VCP will send a BootNotification and start new Charging Session with StartTransaction.
 * Use for load/stress testing.
 * Adjust this script for creating real-world scenarios (e.g. launch Charging Session only for 30% of Stations)
 */
(async () => {
  const chargePointsCount = Number.parseInt(process.env.CP_COUNT ?? "1000");
  for (let i = 1; i <= chargePointsCount; i++) {
    const chargePointIdPrefix = process.env.ID_PREFIX ?? "CS_1_";
    const vcp = new VCP({
      endpoint: process.env.WS_URL ?? "ws://localhost:5555",
      chargePointId: `${chargePointIdPrefix}${i}`,
      ocppVersion: OcppVersion.OCPP_1_6,
      basicAuthPassword: process.env.PASSWORD ?? undefined,
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
        startTransactionOcppMessage.request({
          connectorId: 1,
          idTag: "TEST",
          meterStart: 0,
          timestamp: new Date().toISOString(),
        }),
      );
    });
    await new Promise((r) => setTimeout(r, 100));
  }
})();
