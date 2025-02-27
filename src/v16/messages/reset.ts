import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import { delay } from "../../utils";
import type { VCP } from "../../vcp";

const ResetReqSchema = z.object({
  type: z.enum(["Hard", "Soft"]),
});
type ResetReqType = typeof ResetReqSchema;

const ResetResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type ResetResType = typeof ResetResSchema;

class ResetOcppMessage extends OcppIncoming<ResetReqType, ResetResType> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ResetReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
    if (call.payload.type === "Hard") {
      await delay(3_000);
      vcp.close();
    }
  };
}

export const resetOcppMessage = new ResetOcppMessage(
  "Reset",
  ResetReqSchema,
  ResetResSchema,
);
