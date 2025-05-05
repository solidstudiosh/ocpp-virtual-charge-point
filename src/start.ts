require("dotenv").config();

import { OcppVersion } from "./ocppVersion";
import { bootNotificationOcppMessage } from "./v16/messages/bootNotification";
import { statusNotificationOcppMessage } from "./v16/messages/statusNotification";
import { bootNotificationOcppOutgoing } from "../src/v21/messages/bootNotification";
import { statusNotificationOcppOutgoing } from "../src/v21/messages/statusNotification";
import { VCP } from "./vcp";

function createVcp(ocppVersion: OcppVersion): VCP {
  return new VCP({
    endpoint: process.env.WS_URL ?? "ws://localhost:3000",
    chargePointId: process.env.CP_ID ?? "123456",
    ocppVersion: ocppVersion,
    basicAuthPassword: process.env.PASSWORD ?? undefined,
    adminPort: Number.parseInt(process.env.ADMIN_PORT ?? "9999"),
  });
}

function sendStatusNotifications(vcp: VCP, connectorsNum: number) {
  for (let i = 1; i <= connectorsNum; i++) {
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: i,
        errorCode: "NoError",
        status: "Available",
      }),
    );
  }
}

async function start_16(connectorsNum: number) {
  const vcp = createVcp(OcppVersion.OCPP_1_6);
  await vcp.connect();
  vcp.send(
    bootNotificationOcppMessage.request({
      chargePointVendor: "Solidstudio",
      chargePointModel: "VirtualChargePoint",
      chargePointSerialNumber: "S001",
      firmwareVersion: "1.0.0",
    }),
  );
  sendStatusNotifications(vcp, connectorsNum);
}

async function start_2x(ocppVersion: OcppVersion) {
  const vcp = createVcp(ocppVersion);
  await vcp.connect();
  vcp.send(
    bootNotificationOcppOutgoing.request({
      reason: "PowerUp",
      chargingStation: {
        model: "VirtualChargePoint",
        vendorName: "Solidstudio",
      },
    }),
  );
  vcp.send(
    statusNotificationOcppOutgoing.request({
      evseId: 1,
      connectorId: 1,
      connectorStatus: "Available",
      timestamp: new Date().toISOString(),
    }),
  );
}

(async () => {
  const cpStartType = process.env.CP_START_TYPE ?? "16";

  console.log(`CP_START_TYPE is ${JSON.stringify(cpStartType)}`)
  
  if (cpStartType === "16_2_connectors") {
    await start_16(2);
  } else if (cpStartType === "16") {
    await start_16(1);
  } else if (cpStartType === "21") {
    await start_2x(OcppVersion.OCPP_2_1);
  } else if (cpStartType === "201") {
    await start_2x(OcppVersion.OCPP_2_0_1);
  } else {
    throw new Error(`Invalid CP_START_TYPE: ${cpStartType}`);
  }
})();