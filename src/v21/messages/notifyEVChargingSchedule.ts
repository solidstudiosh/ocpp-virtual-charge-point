import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import { ChargingScheduleSchema } from "../../v16/messages/_common";
import type { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const NotifyEVChargingScheduleReqSchema = z.object({
  timeBase: z.string().datetime(),
  evseId: z.number().int(),
  selectedChargingScheduleId: z.number().int().nullish(),
  powerToleranceAcceptance: z.boolean().nullish(),
  chargingSchedule: ChargingScheduleSchema,
});
type NotifyEVChargingScheduleReqType = typeof NotifyEVChargingScheduleReqSchema;

const NotifyEVChargingScheduleResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type NotifyEVChargingScheduleResType = typeof NotifyEVChargingScheduleResSchema;

class NotifyEVChargingScheduleOcppMessage extends OcppMessage<
  NotifyEVChargingScheduleReqType,
  NotifyEVChargingScheduleResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyEVChargingScheduleReqType>>,
    _result: OcppCallResult<z.infer<NotifyEVChargingScheduleResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyEVChargingScheduleOcppMessage =
  new NotifyEVChargingScheduleOcppMessage(
    "NotifyEVChargingSchedule",
    NotifyEVChargingScheduleReqSchema,
    NotifyEVChargingScheduleResSchema,
  );
