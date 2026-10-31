import { z } from "zod";
import { logger } from "../../logger";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { DateTimeSchema } from "./_common";

const BootNotificationReqSchema = z.object({
  chargePointVendor: z.string().max(20),
  chargePointModel: z.string().max(20),
  chargePointSerialNumber: z.string().max(25).nullish(),
  chargeBoxSerialNumber: z.string().max(25).nullish(),
  firmwareVersion: z.string().max(20).nullish(),
  iccid: z.string().max(20).nullish(),
  imsi: z.string().max(20).nullish(),
  meterType: z.string().max(25).nullish(),
  meterSerialNumber: z.string().max(25).nullish(),
});
type BootNotificationReqType = typeof BootNotificationReqSchema;

const BootNotificationResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  currentTime: DateTimeSchema.nullish(),
  heartbeatInterval: z.number().int().nullish(),
});
type BootNotificationResType = typeof BootNotificationResSchema;

// A 1.2 box without an interval still has to show it is alive: the gateway
// closes the central system socket of a box that stays silent (idle close).
const DEFAULT_HEARTBEAT_INTERVAL_SEC = 60;

class BootNotificationOcppMessage extends OcppOutgoing<
  BootNotificationReqType,
  BootNotificationResType
> {
  resHandler = async (
    vcp: VCP,
    _call: OcppCall<z.infer<BootNotificationReqType>>,
    result: OcppCallResult<z.infer<BootNotificationResType>>,
  ): Promise<void> => {
    const interval =
      result.payload.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL_SEC;
    if (result.payload.status !== "Accepted") {
      logger.warn(
        `BootNotification ${result.payload.status}; heartbeat every ${interval} s anyway`,
      );
    }
    vcp.configureHeartbeat(interval * 1000);
  };
}

export const bootNotificationOcppMessage = new BootNotificationOcppMessage(
  "BootNotification",
  BootNotificationReqSchema,
  BootNotificationResSchema,
);
