import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const StatusNotificationReqSchema = z.object({
  timestamp: z.string().datetime(),
  connectorStatus: z.enum([
    "Available",
    "Occupied",
    "Reserved",
    "Unavailable",
    "Faulted",
  ]),
  evseId: z.number().int(),
  connectorId: z.number().int(),
});
type StatusNotificationReqType = typeof StatusNotificationReqSchema;

const StatusNotificationResSchema = z.object({});
type StatusNotificationResType = typeof StatusNotificationResSchema;

class StatusNotificationOcppOutgoing extends OcppOutgoing<
  StatusNotificationReqType,
  StatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<StatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<StatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const statusNotificationOcppOutgoing =
  new StatusNotificationOcppOutgoing(
    "StatusNotification",
    StatusNotificationReqSchema,
    StatusNotificationResSchema,
  );
