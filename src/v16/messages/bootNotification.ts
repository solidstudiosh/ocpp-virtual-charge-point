import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const BootNotificationReqSchema = z.object({
  chargeBoxSerialNumber: z.string().max(25).nullish(),
  chargePointModel: z.string().max(20),
  chargePointSerialNumber: z.string().max(25).nullish(),
  chargePointVendor: z.string().max(20),
  firmwareVersion: z.string().max(50).nullish(),
  iccid: z.string().max(20).nullish(),
  imsi: z.string().max(20).nullish(),
  meterSerialNumber: z.string().max(25).nullish(),
  meterType: z.string().max(25).nullish(),
});
type BootNotificationReqType = typeof BootNotificationReqSchema;

const BootNotificationResSchema = z.object({
  currentTime: z.string().datetime(),
  interval: z.number().int(),
  status: z.enum(["Accepted", "Pending", "Rejected"]),
});
type BootNotificationResType = typeof BootNotificationResSchema;

class BootNotificationOcppMessage extends OcppOutgoing<
  BootNotificationReqType,
  BootNotificationResType
> {
  resHandler = async (
    vcp: VCP,
    _call: OcppCall<z.infer<BootNotificationReqType>>,
    result: OcppCallResult<z.infer<BootNotificationResType>>,
  ): Promise<void> => {
    vcp.configureHeartbeat(result.payload.interval * 1000);
  };
}

export const bootNotificationOcppMessage = new BootNotificationOcppMessage(
  "BootNotification",
  BootNotificationReqSchema,
  BootNotificationResSchema,
);
