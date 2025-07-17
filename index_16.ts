require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { bootNotificationOcppMessage } from "./src/v16/messages/bootNotification";
import { statusNotificationOcppMessage } from "./src/v16/messages/statusNotification";
import { VCP } from "./src/vcp";

const vcp = new VCP({
  endpoint: process.env.WS_URL ?? "ws://localhost:3000",
  chargePointId: process.env.CP_ID ?? "123456",
  ocppVersion: OcppVersion.OCPP_1_6,
  basicAuthPassword: process.env.PASSWORD ?? undefined,
  adminPort: Number.parseInt(process.env.ADMIN_PORT ?? "9999"),
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n📴 Received ${signal}, taking charger offline...`);

  try {
    // Send "Unavailable" status to indicate charger is going offline
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: 101,
        errorCode: "NoError",
        status: "Unavailable",
        timestamp: new Date().toISOString(),
      }),
    );

    console.log("✅ Charger taken offline gracefully");
    console.log("💡 Press Enter to return to command prompt");

    // Close the connection after a short delay to ensure message is sent
    setTimeout(() => {
      vcp.close();
      process.exit(0);
    }, 500);

  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    console.log("💡 Press Enter to return to command prompt");
    process.exit(1);
  }
};

// Register signal handlers for graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Interrupt signal received...');
  gracefulShutdown('SIGINT (Ctrl+C)');
});
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});
process.on('SIGHUP', () => {
  gracefulShutdown('SIGHUP');
});

// Handle unexpected exits
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

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
  console.log(`💡 Press Ctrl+C to take charger offline gracefully`);
})();
