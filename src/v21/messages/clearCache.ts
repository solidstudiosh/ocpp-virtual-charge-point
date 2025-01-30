import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const ClearCacheReqSchema = z.object({});
type ClearCacheReqType = typeof ClearCacheReqSchema;

const ClearCacheResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ClearCacheResType = typeof ClearCacheResSchema;

class ClearCacheOcppMessage extends OcppMessage<
  ClearCacheReqType,
  ClearCacheResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ClearCacheReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const clearCacheOcppMessage = new ClearCacheOcppMessage(
  "ClearCache",
  ClearCacheReqSchema,
  ClearCacheResSchema,
);
