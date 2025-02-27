import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const BootNotificationReqSchema = z.object({
  reason: z.enum([
    "ApplicationReset",
    "FirmwareUpdate",
    "LocalReset",
    "PowerUp",
    "RemoteReset",
    "ScheduledReset",
    "Triggered",
    "Unknown",
    "Watchdog",
  ]),
  chargingStation: z.object({
    serialNumber: z.string().max(25).nullish(),
    model: z.string().max(20),
    vendorName: z.string().max(50),
    firmwareVersion: z.string().max(50).nullish(),
    modem: z
      .object({
        iccid: z.string().max(20).nullish(),
        imsi: z.string().max(20).nullish(),
      })
      .nullish(),
  }),
});
type BootNotificationReqType = typeof BootNotificationReqSchema;

const BootNotificationResSchema = z.object({
  currentTime: z.string().datetime(),
  interval: z.number().int(),
  status: z.enum(["Accepted", "Pending", "Rejected"]),
  statusInfo: z
    .object({
      reasonCode: z.string().max(20),
      additionalInfo: z.string().max(512).nullish(),
    })
    .nullish(),
});
type BootNotificationResType = typeof BootNotificationResSchema;

class BootNotificationOcppOutgoing extends OcppOutgoing<
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

export const bootNotificationOcppOutgoing = new BootNotificationOcppOutgoing(
  "BootNotification",
  BootNotificationReqSchema,
  BootNotificationResSchema,
);
