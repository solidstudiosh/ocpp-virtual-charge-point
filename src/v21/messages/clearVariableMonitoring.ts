import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const ClearVariableMonitoringReqSchema = z.object({
  id: z.array(z.number().int()),
});
type ClearVariableMonitoringReqType = typeof ClearVariableMonitoringReqSchema;

const ClearVariableMonitoringResSchema = z.object({
  clearMonitoringResult: z.array(
    z.object({
      status: z.enum(["Accepted", "Rejected", "NotFound"]),
      id: z.number().int(),
      statusInfo: StatusInfoTypeSchema.nullish(),
    }),
  ),
});
type ClearVariableMonitoringResType = typeof ClearVariableMonitoringResSchema;

class ClearVariableMonitoringOcppMessage extends OcppMessage<
  ClearVariableMonitoringReqType,
  ClearVariableMonitoringResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ClearVariableMonitoringReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        clearMonitoringResult: call.payload.id.map((id) => ({
          id: id,
          status: "Accepted",
        })),
      }),
    );
  };
}

export const clearVariableMonitoringOcppMessage =
  new ClearVariableMonitoringOcppMessage(
    "ClearVariableMonitoring",
    ClearVariableMonitoringReqSchema,
    ClearVariableMonitoringResSchema,
  );
