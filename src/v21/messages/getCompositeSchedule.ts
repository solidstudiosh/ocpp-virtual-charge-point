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
          limit: z.number().nullish(),
          limit_L2: z.number().nullish(),
          limit_L3: z.number().nullish(),
          numberPhases: z.number().int().min(0).max(3).nullish(),
          phaseToUse: z.number().int().min(1).max(3).nullish(),
          dischargeLimit: z.number().nullish(),
          dischargeLimit_L2: z.number().nullish(),
          dischargeLimit_L3: z.number().nullish(),
          setpoint: z.number().nullish(),
          setpoint_L2: z.number().nullish(),
          setpoint_L3: z.number().nullish(),
          setpointReactive: z.number().nullish(),
          setpointReactive_L2: z.number().nullish(),
          setpointReactive_L3: z.number().nullish(),
          preconditioningRequest: z.boolean().nullish(),
          evseSleep: z.boolean().nullish(),
          v2xBaseline: z.number().nullish(),
          operationMode: z
            .enum([
              "Idle",
              "ChargingOnly",
              "CentralSetpoint",
              "ExternalSetpoint",
              "ExternalLimits",
              "CentralFrequency",
              "LocalFrequency",
              "LocalLoadBalancing",
            ])
            .nullish(),
          v2xFreqWattCurve: z
            .array(
              z.object({
                frequency: z.number(),
                power: z.number(),
              }),
            )
            .max(20)
            .nullish(),
          v2xSignalWattCurve: z
            .array(
              z.object({
                signal: z.number().int(),
                power: z.number(),
              }),
            )
            .max(20)
            .nullish(),
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
