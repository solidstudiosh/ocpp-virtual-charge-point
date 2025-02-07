import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";
import { delay } from "../../utils";

const ResetReqSchema = z.object({
  type: z.enum(["Immediate", "OnIdle", "ImmediateAndResume"]),
  evseId: z.number().int().nullish(),
});
type ResetReqType = typeof ResetReqSchema;

const ResetResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Scheduled"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ResetResType = typeof ResetResSchema;

class ResetOcppMessage extends OcppMessage<ResetReqType, ResetResType> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ResetReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
    await delay(3_000);
    process.exit(1);
  };
}

export const resetOcppMessage = new ResetOcppMessage(
  "Reset",
  ResetReqSchema,
  ResetResSchema,
);
