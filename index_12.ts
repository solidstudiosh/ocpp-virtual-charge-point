require("dotenv").config();

import { OcppVersion } from "./src/ocppVersion";
import { registerVcp } from "./src/close";
import {
  OCPP12_NAMESPACES,
  type Ocpp12Namespace,
} from "./src/soap/ocpp12Schema";
import { bootNotificationOcppMessage } from "./src/v12/messages/bootNotification";
import { statusNotificationOcppMessage } from "./src/v12/messages/statusNotification";
import { countFromEnv } from "./src/utils";
import { VCP } from "./src/vcp";

const namespace = (process.env.OCPP12_NS ?? "2010_08") as Ocpp12Namespace;
if (!OCPP12_NAMESPACES.includes(namespace)) {
  throw new Error(`OCPP12_NS must be one of ${OCPP12_NAMESPACES}`);
}

async function main(): Promise<VCP> {
  const connectors = countFromEnv("CONNECTORS");
  const chargePointId = process.env.CP_ID ?? "123456";
  const serverPort = Number.parseInt(process.env.SOAP_SERVER_PORT ?? "9100");
  const vcp = new VCP({
    endpoint:
      process.env.SOAP_CS_URL ??
      "http://localhost:8080/ocpp/CentralSystemService",
    chargePointId,
    ocppVersion: OcppVersion.OCPP_1_2,
    adminPort: Number.parseInt(process.env.ADMIN_PORT ?? "9999"),
    soap: {
      namespace,
      serverPort,
      advertisedUrl:
        process.env.SOAP_ADVERTISED_URL ??
        `http://localhost:${serverPort}/ocpp/ChargePointService/${chargePointId}`,
    },
  });
  await vcp.connect();
  vcp.send(
    bootNotificationOcppMessage.request({
      chargePointVendor: "Solidstudio",
      chargePointModel: "VirtualChargePoint",
      chargePointSerialNumber: "S001",
      firmwareVersion: "1.0.0",
    }),
  );
  for (let connectorId = 1; connectorId <= connectors; connectorId++) {
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId,
        errorCode: "NoError",
        status: "Available",
      }),
    );
  }
  return vcp;
}

main().then((vcp) => registerVcp(vcp, main));
