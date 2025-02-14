import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const SetMonitoringBaseReqSchema = z.object({
  monitoringBase: z.enum(["All", "FactoryDefault", "HardWiredOnly"]),
});
type SetMonitoringBaseReqType = typeof SetMonitoringBaseReqSchema;

const SetMonitoringBaseResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotSupported", "EmptyResultSet"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SetMonitoringBaseResType = typeof SetMonitoringBaseResSchema;

class SetMonitoringBaseOcppMessage extends OcppMessage<
  SetMonitoringBaseReqType,
  SetMonitoringBaseResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetMonitoringBaseReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setMonitoringBaseOcppMessage = new SetMonitoringBaseOcppMessage(
  "SetMonitoringBase",
  SetMonitoringBaseReqSchema,
  SetMonitoringBaseResSchema,
);
