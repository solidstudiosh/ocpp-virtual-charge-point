import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const ClearDisplayMessageReqSchema = z.object({
  id: z.number().int(),
});
type ClearDisplayMessageReqType = typeof ClearDisplayMessageReqSchema;

const ClearDisplayMessageResSchema = z.object({
  status: z.enum(["Accepted", "Unknown", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ClearDisplayMessageResType = typeof ClearDisplayMessageResSchema;

class ClearDisplayMessageOcppIncoming extends OcppIncoming<
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

export const clearDisplayMessageOcppIncoming =
  new ClearDisplayMessageOcppIncoming(
    "ClearDisplayMessage",
    ClearDisplayMessageReqSchema,
    ClearDisplayMessageResSchema,
  );
