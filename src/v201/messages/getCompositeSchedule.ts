import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const GetCompositeScheduleReqSchema = z.object({
  duration: z.number().int(),
  chargingRateUnit: z.enum(["A", "W"]).nullish(),
  evseId: z.number().int(),
});
type GetCompositeScheduleReqType = typeof GetCompositeScheduleReqSchema;

const GetCompositeScheduleResSchema = z.object({
  status: GenericStatusEnumSchema,
  schedule: z
    .object({
      evseId: z.number().int(),
      duration: z.number().int(),
      scheduleStart: z.string().datetime(),
      chargingRateUnit: z.enum(["A", "W"]),
      chargingSchedulePeriod: z.array(
        z.object({
          startPeriod: z.number().int(),
          limit: z.number().multipleOf(0.1),
          numberPhases: z.number().int().nullish(),
          phaseToUse: z.number().int().min(1).max(3).nullish(),
        }),
      ),
    })
    .nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetCompositeScheduleResType = typeof GetCompositeScheduleResSchema;

class GetCompositeScheduleOcppIncoming extends OcppIncoming<
  GetCompositeScheduleReqType,
  GetCompositeScheduleResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetCompositeScheduleReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const getCompositeScheduleOcppIncoming =
  new GetCompositeScheduleOcppIncoming(
    "GetCompositeSchedule",
    GetCompositeScheduleReqSchema,
    GetCompositeScheduleResSchema,
  );
