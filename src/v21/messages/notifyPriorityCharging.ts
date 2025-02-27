import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const NotifyPriorityChargingReqSchema = z.object({
  transactionId: z.string().max(36),
  activated: z.boolean(),
});
type NotifyPriorityChargingReqType = typeof NotifyPriorityChargingReqSchema;

const NotifyPriorityChargingResSchema = z.object({});
type NotifyPriorityChargingResType = typeof NotifyPriorityChargingResSchema;

class NotifyPriorityChargingOcppOutgoing extends OcppOutgoing<
  NotifyPriorityChargingReqType,
  NotifyPriorityChargingResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyPriorityChargingReqType>>,
    _result: OcppCallResult<z.infer<NotifyPriorityChargingResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyPriorityChargingOcppOutgoing =
  new NotifyPriorityChargingOcppOutgoing(
    "NotifyPriorityCharging",
    NotifyPriorityChargingReqSchema,
    NotifyPriorityChargingResSchema,
  );
