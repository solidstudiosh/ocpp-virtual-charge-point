require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { bootNotificationOcppOutgoing } from "./src/v21/messages/bootNotification";
import { statusNotificationOcppOutgoing } from "./src/v21/messages/statusNotification";
import { meterValuesOcppOutgoing } from "./src/v21/messages/meterValues";
import { VCP } from "./src/vcp";
import { createGracefulShutdown, registerShutdownHandlers } from "./src/gracefulShutdown";
import { MeterReadingsManager } from "./src/meterReadings";

const vcp = new VCP({
  endpoint: process.env.WS_URL ?? "ws://localhost:3000",
  chargePointId: process.env.CP_ID ?? "123456",
  ocppVersion: OcppVersion.OCPP_2_1,
  basicAuthPassword: process.env.PASSWORD ?? undefined,
  adminPort: Number.parseInt(process.env.ADMIN_PORT ?? "9999"),
});

// Initialize meter readings manager for OCPP 2.1
const meterManager = new MeterReadingsManager(
  vcp,
  meterValuesOcppOutgoing,
  false, // isOcpp16 (false for 2.1)
  1,     // connectorId
  1      // evseId
);

// Create graceful shutdown handler
const gracefulShutdown = createGracefulShutdown(
  vcp,
  statusNotificationOcppOutgoing,
  { evseId: 1, connectorId201: 1 }, // OCPP 2.1 config
  () => meterManager.stop() // cleanup callback
);

// Register signal handlers
registerShutdownHandlers(gracefulShutdown);

(async () => {
  await vcp.connect();

  // Enhanced boot notification - all configurable via .env (OCPP 2.1)
  vcp.send(
    bootNotificationOcppOutgoing.request({
      reason: "PowerUp",
      chargingStation: {
        vendorName: process.env.CHARGER_VENDOR ?? "Solidstudio",
        model: process.env.CHARGER_MODEL ?? "VirtualChargePoint",
        serialNumber: process.env.CHARGER_SERIAL ?? "S001",
        firmwareVersion: process.env.FIRMWARE_VERSION ?? "OCPP2.1-v1.0.0",
        modem: {
          iccid: process.env.MODEM_ICCID ?? undefined,
          imsi: process.env.MODEM_IMSI ?? undefined,
        },
      },
    }),
  );

  // Status notification for EVSE 1, Connector 1 → Socket 101 in eMabler
  vcp.send(
    statusNotificationOcppOutgoing.request({
      evseId: 1,
      connectorId: 1,
      connectorStatus: "Available",
      timestamp: new Date().toISOString(),
    }),
  );

  console.log(`Started ${process.env.CHARGER_MODEL ?? "VirtualChargePoint"} (OCPP 2.1) with:`);
  console.log(`- Power Type: ${process.env.POWER_TYPE ?? "AC_three_phase"}`);
  console.log(`- Connector: ${process.env.CONNECTOR_TYPE ?? "Type2"}`);
  console.log(`- Max Power: ${process.env.MAX_POWER_KW ?? "22"}kW`);
  console.log(`- Max Current: ${process.env.MAX_CURRENT_A ?? "32"}A`);
  console.log(`- Voltage: ${process.env.VOLTAGE_V ?? "230"}V per phase`);
  console.log(`- EVSE: 1, Connector: 1 → Socket 101`);
  console.log(`\n🟢 Charger online`);
  console.log(`💡 Press Ctrl+C to take charger offline gracefully`);

  // Start meter readings
  meterManager.start();
})();
