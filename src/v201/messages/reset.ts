import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import { delay } from "../../utils";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const ResetReqSchema = z.object({
  type: z.enum(["Immediate", "OnIdle"]),
  evseId: z.number().int().nullish(),
});
type ResetReqType = typeof ResetReqSchema;

const ResetResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Scheduled"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ResetResType = typeof ResetResSchema;

class ResetOcppIncoming extends OcppIncoming<ResetReqType, ResetResType> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ResetReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
    await delay(3_000);
    process.exit(1);
  };
}

export const resetOcppIncoming = new ResetOcppIncoming(
  "Reset",
  ResetReqSchema,
  ResetResSchema,
);
