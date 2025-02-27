import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const SetMonitoringLevelReqSchema = z.object({
  severity: z.number().int().min(0).max(9),
});
type SetMonitoringLevelReqType = typeof SetMonitoringLevelReqSchema;

const SetMonitoringLevelResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SetMonitoringLevelResType = typeof SetMonitoringLevelResSchema;

class SetMonitoringLevelOcppIncoming extends OcppIncoming<
  SetMonitoringLevelReqType,
  SetMonitoringLevelResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetMonitoringLevelReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setMonitoringLevelOcppIncoming =
  new SetMonitoringLevelOcppIncoming(
    "SetMonitoringLevel",
    SetMonitoringLevelReqSchema,
    SetMonitoringLevelResSchema,
  );
