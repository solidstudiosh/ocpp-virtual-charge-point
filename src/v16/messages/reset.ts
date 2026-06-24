import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import { delay } from "../../utils";
import type { VCP } from "../../vcp";
import { logger } from "../../logger";
import { close } from "../../close";

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
    logger.info("Waiting for 3 seconds to close VCP...");
    await delay(3_000);
    logger.info("Closing VCP");
    close(vcp);
  };
}

export const resetOcppMessage = new ResetOcppMessage(
  "Reset",
  ResetReqSchema,
  ResetResSchema,
);
