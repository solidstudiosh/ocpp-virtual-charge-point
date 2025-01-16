import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const ClearDisplayMessageReqSchema = z.object({
  id: z.number().int(),
});
type ClearDisplayMessageReqType = typeof ClearDisplayMessageReqSchema;

const ClearDisplayMessageResSchema = z.object({
  status: z.enum(["Accepted", "Unknown"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ClearDisplayMessageResType = typeof ClearDisplayMessageResSchema;

class ClearDisplayMessageOcppMessage extends OcppMessage<
  ClearDisplayMessageReqType,
  ClearDisplayMessageResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ClearDisplayMessageReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const clearDisplayMessageOcppMessage =
  new ClearDisplayMessageOcppMessage(
    "ClearDisplayMessage",
    ClearDisplayMessageReqSchema,
    ClearDisplayMessageResSchema,
  );
