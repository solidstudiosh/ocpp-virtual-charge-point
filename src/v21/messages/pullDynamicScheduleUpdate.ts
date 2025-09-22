import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargingScheduleUpdate, StatusInfoTypeSchema } from "./_common";

const PullDynamicScheduleUpdateReqSchema = z.object({
  chargingProfileId: z.number().int(),
});
type PullDynamicScheduleUpdateReqType =
  typeof PullDynamicScheduleUpdateReqSchema;

const PullDynamicScheduleUpdateResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  scheduleUpdate: ChargingScheduleUpdate.nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type PullDynamicScheduleUpdateResType =
  typeof PullDynamicScheduleUpdateResSchema;

class PullDynamicScheduleUpdateOcppOutgoing extends OcppOutgoing<
  PullDynamicScheduleUpdateReqType,
  PullDynamicScheduleUpdateResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<PullDynamicScheduleUpdateReqType>>,
    _result: OcppCallResult<z.infer<PullDynamicScheduleUpdateResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const pullDynamicScheduleUpdateOcppOutgoing =
  new PullDynamicScheduleUpdateOcppOutgoing(
    "PullDynamicScheduleUpdate",
    PullDynamicScheduleUpdateReqSchema,
    PullDynamicScheduleUpdateResSchema,
  );
