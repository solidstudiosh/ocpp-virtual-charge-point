import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { MessageInfoSchema, StatusInfoTypeSchema } from "./_common";

const SetDisplayMessageReqSchema = z.object({
  message: MessageInfoSchema,
});
type SetDisplayMessageReqType = typeof SetDisplayMessageReqSchema;

const SetDisplayMessageResSchema = z.object({
  status: z.enum([
    "Accepted",
    "NotSupportedMessageFormat",
    "Rejected",
    "NotSupportedPriority",
    "NotSupportedState",
    "UnknownTransaction",
  ]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SetDisplayMessageResType = typeof SetDisplayMessageResSchema;

class SetDisplayMessageOcppIncoming extends OcppIncoming<
  SetDisplayMessageReqType,
  SetDisplayMessageResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetDisplayMessageReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setDisplayMessageOcppIncoming = new SetDisplayMessageOcppIncoming(
  "SetDisplayMessage",
  SetDisplayMessageReqSchema,
  SetDisplayMessageResSchema,
);
