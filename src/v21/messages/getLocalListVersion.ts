import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const GetLocalListVersionReqSchema = z.object({});
type GetLocalListVersionReqType = typeof GetLocalListVersionReqSchema;

const GetLocalListVersionResSchema = z.object({
  versionNumber: z.number().int(),
});
type GetLocalListVersionResType = typeof GetLocalListVersionResSchema;

class GetLocalListVersionOcppIncoming extends OcppIncoming<
  GetLocalListVersionReqType,
  GetLocalListVersionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetLocalListVersionReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { versionNumber: 1 }));
  };
}

export const getLocalListVersionOcppIncoming =
  new GetLocalListVersionOcppIncoming(
    "GetLocalListVersion",
    GetLocalListVersionReqSchema,
    GetLocalListVersionResSchema,
  );
