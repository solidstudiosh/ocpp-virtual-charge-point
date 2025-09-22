import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargingScheduleSchema } from "./_common";

const NotifyChargingLimitReqSchema = z.object({
  evseId: z.number().int().nullish(),
  chargingLimit: z.object({
    chargingLimitSource: z.enum(["EMS", "Other", "SO", "CSO"]),
    isLocalGeneration: z.boolean().nullish(),
    isGridCritical: z.boolean().nullish(),
  }),
  chargingSchedule: z.array(ChargingScheduleSchema).nullish(),
});

type NotifyChargingLimitReqType = typeof NotifyChargingLimitReqSchema;

const NotifyChargingLimitResSchema = z.object({});

type NotifyChargingLimitResType = typeof NotifyChargingLimitResSchema;

class NotifyChargingLimitOcppOutgoing extends OcppOutgoing<
  NotifyChargingLimitReqType,
  NotifyChargingLimitResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyChargingLimitReqType>>,
    _result: OcppCallResult<z.infer<NotifyChargingLimitResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyChargingLimitOcppOutgoing =
  new NotifyChargingLimitOcppOutgoing(
    "NotifyChargingLimit",
    NotifyChargingLimitReqSchema,
    NotifyChargingLimitResSchema,
  );
