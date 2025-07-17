require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { bootNotificationOcppMessage } from "./src/v16/messages/bootNotification";
import { statusNotificationOcppMessage } from "./src/v16/messages/statusNotification";
import { meterValuesOcppMessage } from "./src/v16/messages/meterValues";
import { VCP } from "./src/vcp";
import { createGracefulShutdown, registerShutdownHandlers } from "./src/gracefulShutdown";
import { MeterReadingsManager } from "./src/meterReadings";

const vcp = new VCP({
  endpoint: process.env.WS_URL ?? "ws://localhost:3000",
  chargePointId: process.env.CP_ID ?? "123456",
  ocppVersion: OcppVersion.OCPP_1_6,
  basicAuthPassword: process.env.PASSWORD ?? undefined,
  adminPort: Number.parseInt(process.env.ADMIN_PORT ?? "9999"),
});

// Initialize meter readings manager for OCPP 1.6
const meterManager = new MeterReadingsManager(
  vcp,
  meterValuesOcppMessage,
  true, // isOcpp16
  101   // connectorId
);

// Create graceful shutdown handler
const gracefulShutdown = createGracefulShutdown(
  vcp,
  statusNotificationOcppMessage,
  { connectorId: 101 }, // OCPP 1.6 config
  () => meterManager.stop() // cleanup callback
);

// Register signal handlers
registerShutdownHandlers(gracefulShutdown);

(async () => {
  await vcp.connect();

  // Enhanced boot notification - all configurable via .env
  vcp.send(
    bootNotificationOcppMessage.request({
      chargePointVendor: process.env.CHARGER_VENDOR ?? "Solidstudio",
      chargePointModel: process.env.CHARGER_MODEL ?? "VirtualChargePoint",
      chargePointSerialNumber: process.env.CHARGER_SERIAL ?? "S001",
      firmwareVersion: process.env.FIRMWARE_VERSION ?? "OCPP1.6-v1.0.0",
    }),
  );

  // Status notification for single connector with specific capabilities
  vcp.send(
    statusNotificationOcppMessage.request({
      connectorId: 101,
      errorCode: "NoError",
      status: "Available",
      timestamp: new Date().toISOString(),
    }),
  );

  console.log(`Started ${process.env.CHARGER_MODEL ?? "VirtualChargePoint"} with:`);
  console.log(`- Power Type: ${process.env.POWER_TYPE ?? "AC_three_phase"}`);
  console.log(`- Connector: ${process.env.CONNECTOR_TYPE ?? "Type2"}`);
  console.log(`- Max Power: ${process.env.MAX_POWER_KW ?? "22"}kW`);
  console.log(`- Max Current: ${process.env.MAX_CURRENT_A ?? "32"}A`);
  console.log(`- Voltage: ${process.env.VOLTAGE_V ?? "230"}V per phase`);
  console.log(`- Connector: 101`);
  console.log(`\n🟢 Charger online`);
  console.log(`💡 Press Ctrl+C to shutdown gracefully (blocked during charging)`);
  console.log(`💡 During charging: Ctrl+C → then Ctrl+Q to force shutdown`);

  // Start meter readings
  meterManager.start();
})();
