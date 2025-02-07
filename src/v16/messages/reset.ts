import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { delay } from "../../utils";

const ResetReqSchema = z.object({
  type: z.enum(["Hard", "Soft"]),
});
type ResetReqType = typeof ResetReqSchema;

const ResetResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type ResetResType = typeof ResetResSchema;

class ResetOcppMessage extends OcppMessage<ResetReqType, ResetResType> {
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
