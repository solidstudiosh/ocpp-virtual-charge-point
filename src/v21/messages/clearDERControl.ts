import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { DERControlType, StatusInfoTypeSchema } from "./_common";

const ClearDERControlReqSchema = z.object({
  isDefault: z.boolean(),
  controlType: DERControlType.nullish(),
  controlId: z.string().max(36).nullish(),
});
type ClearDERControlReqType = typeof ClearDERControlReqSchema;

const ClearDERControlResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotSupported", "NotFound"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ClearDERControlResType = typeof ClearDERControlResSchema;

class ClearDERControlOcppIncoming extends OcppIncoming<
  ClearDERControlReqType,
  ClearDERControlResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ClearDERControlReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const clearDERControlOcppIncoming = new ClearDERControlOcppIncoming(
  "ClearDERControl",
  ClearDERControlReqSchema,
  ClearDERControlResSchema,
);
