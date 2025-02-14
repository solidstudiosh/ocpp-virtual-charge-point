import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const GetDisplayMessagesReqSchema = z.object({
  id: z.array(z.number().int()).nullish(),
  requestId: z.number().int(),
  priority: z.enum(["AlwaysFront", "InFront", "NormalCycle"]).nullish(),
  state: z
    .enum([
      "Charging",
      "Faulted",
      "Idle",
      "Unavailable",
      "Suspended",
      "Discharging",
    ])
    .nullish(),
});
type GetDisplayMessagesReqType = typeof GetDisplayMessagesReqSchema;

const GetDisplayMessagesResSchema = z.object({
  status: z.enum(["Accepted", "Unknown"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetDisplayMessagesResType = typeof GetDisplayMessagesResSchema;

class GetDisplayMessagesOcppMessage extends OcppMessage<
  GetDisplayMessagesReqType,
  GetDisplayMessagesResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetDisplayMessagesReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const getDisplayMessagesOcppMessage = new GetDisplayMessagesOcppMessage(
  "GetDisplayMessages",
  GetDisplayMessagesReqSchema,
  GetDisplayMessagesResSchema,
);
