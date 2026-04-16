require("dotenv").config();

import { logger } from "./src/logger";
import { OcppVersion } from "./src/ocppVersion";
import { VCP } from "./src/vcp";

const resolveOcppVersion = (): OcppVersion => {
  const configured = process.env.OCPP_VERSION;
  if (configured === OcppVersion.OCPP_2_0_1) {
    return OcppVersion.OCPP_2_0_1;
  }
  if (configured === OcppVersion.OCPP_2_1) {
    return OcppVersion.OCPP_2_1;
  }
  return OcppVersion.OCPP_1_6;
};

const adminPort = Number.parseInt(process.env.ADMIN_PORT ?? "9999", 10);

new VCP({
  endpoint: process.env.WS_URL ?? "ws://localhost:3000",
  chargePointId: process.env.CP_ID ?? "123456",
  ocppVersion: resolveOcppVersion(),
  basicAuthPassword: process.env.PASSWORD ?? undefined,
  adminPort,
  closeProcessOnConnectionError: false,
});

logger.info(`VCP UI server started on http://localhost:${adminPort}`);
logger.info("Use the UI to connect and control the virtual charge point");
