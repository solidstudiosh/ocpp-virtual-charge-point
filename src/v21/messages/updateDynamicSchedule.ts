import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargingScheduleUpdate, StatusInfoTypeSchema } from "./_common";

const UpdateDynamicScheduleReqSchema = z.object({
  chargingProfileId: z.number().int(),
  scheduleUpdate: ChargingScheduleUpdate,
});
type UpdateDynamicScheduleReqType = typeof UpdateDynamicScheduleReqSchema;

const UpdateDynamicScheduleResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type UpdateDynamicScheduleResType = typeof UpdateDynamicScheduleResSchema;

class UpdateDynamicScheduleOcppIncoming extends OcppIncoming<
  UpdateDynamicScheduleReqType,
  UpdateDynamicScheduleResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<UpdateDynamicScheduleReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const updateDynamicScheduleOcppIncoming =
  new UpdateDynamicScheduleOcppIncoming(
    "UpdateDynamicSchedule",
    UpdateDynamicScheduleReqSchema,
    UpdateDynamicScheduleResSchema,
  );
