import { z } from "zod";
import { logger } from "../../logger";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const ChangeConfigurationReqSchema = z.object({
  key: z.string().max(50),
  value: z.string().max(500),
});
type ChangeConfigurationReqType = typeof ChangeConfigurationReqSchema;

const ChangeConfigurationResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotSupported"]),
});
type ChangeConfigurationResType = typeof ChangeConfigurationResSchema;

// The 1.2 spec spells the key HeartBeatInterval; accept the 1.6 spelling too.
const HEARTBEAT_INTERVAL_KEYS = ["HeartBeatInterval", "HeartbeatInterval"];

class ChangeConfigurationOcppMessage extends OcppIncoming<
  ChangeConfigurationReqType,
  ChangeConfigurationResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ChangeConfigurationReqType>>,
  ): Promise<void> => {
    const { key, value } = call.payload;
    if (!HEARTBEAT_INTERVAL_KEYS.includes(key)) {
      vcp.respond(this.response(call, { status: "Accepted" }));
      return;
    }
    const seconds = Number(value);
    if (!Number.isInteger(seconds) || seconds <= 0) {
      logger.warn(`Rejecting ${key}=${value}: not a positive integer`);
      vcp.respond(this.response(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(this.response(call, { status: "Accepted" }));
    vcp.configureHeartbeat(seconds * 1000);
  };
}

export const changeConfigurationOcppMessage =
  new ChangeConfigurationOcppMessage(
    "ChangeConfiguration",
    ChangeConfigurationReqSchema,
    ChangeConfigurationResSchema,
  );
