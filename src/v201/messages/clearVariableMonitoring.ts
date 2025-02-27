import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const ClearVariableMonitoringReqSchema = z.object({
  id: z.array(z.number().int()),
});
type ClearVariableMonitoringReqType = typeof ClearVariableMonitoringReqSchema;

const ClearVariableMonitoringResSchema = z.object({
  clearMonitoringResult: z.array(
    z.object({
      id: z.number().int(),
      status: z.enum(["Accepted", "Rejected", "NotFound"]),
      statusInfo: StatusInfoTypeSchema.nullish(),
    }),
  ),
});
type ClearVariableMonitoringResType = typeof ClearVariableMonitoringResSchema;

class ClearVariableMonitoringOcppIncoming extends OcppIncoming<
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

export const clearVariableMonitoringOcppIncoming =
  new ClearVariableMonitoringOcppIncoming(
    "ClearVariableMonitoring",
    ClearVariableMonitoringReqSchema,
    ClearVariableMonitoringResSchema,
  );
