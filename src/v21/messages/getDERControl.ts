import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { DERControlType, StatusInfoTypeSchema } from "./_common";

const GetDERControlReqSchema = z.object({
  requestId: z.number().int(),
  isDefault: z.boolean().nullish(),
  controlType: DERControlType.nullish(),
  controlId: z.string().max(36).nullish(),
});
type GetDERControlReqType = typeof GetDERControlReqSchema;

const GetDERControlResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotSupported", "NotFound"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetDERControlResType = typeof GetDERControlResSchema;

class GetDERControlOcppIncoming extends OcppIncoming<
  GetDERControlReqType,
  GetDERControlResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetDERControlReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const getDERControlOcppIncoming = new GetDERControlOcppIncoming(
  "GetDERControl",
  GetDERControlReqSchema,
  GetDERControlResSchema,
);
