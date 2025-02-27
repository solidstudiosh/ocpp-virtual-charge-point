import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargingScheduleSchema, ConnectorIdSchema } from "./_common";

const GetCompositeScheduleReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  duration: z.number().int(),
  chargingRateUnit: z.enum(["A", "W"]).nullish(),
});
type GetCompositeScheduleReqType = typeof GetCompositeScheduleReqSchema;

const GetCompositeScheduleResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  connectorId: ConnectorIdSchema.nullish(),
  scheduleStart: z.string().datetime().nullish(),
  chargingSchedule: ChargingScheduleSchema.nullish(),
});
type GetCompositeScheduleResType = typeof GetCompositeScheduleResSchema;

class GetCompositeScheduleOcppMessage extends OcppIncoming<
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

export const getCompositeScheduleOcppMessage =
  new GetCompositeScheduleOcppMessage(
    "GetCompositeSchedule",
    GetCompositeScheduleReqSchema,
    GetCompositeScheduleResSchema,
  );
