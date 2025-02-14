import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import { IdTokenSchema } from "../../v16/messages/_common";
import type { VCP } from "../../vcp";
import { IdTokenInfoTypeSchema, StatusInfoTypeSchema } from "./_common";

const SendLocalListReqSchema = z.object({
  versionNumber: z.number().int(),
  updateType: z.enum(["Differential", "Full"]),
  localAuthorizationList: z
    .array(
      z.object({
        idTokenInfo: IdTokenInfoTypeSchema.nullish(),
        idToken: IdTokenSchema,
      }),
    )
    .nullish(),
});
type SendLocalListReqType = typeof SendLocalListReqSchema;

const SendLocalListResSchema = z.object({
  status: z.enum(["Accepted", "Failed", "VersionMismatch"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SendLocalListResType = typeof SendLocalListResSchema;

class SendLocalListOcppMessage extends OcppMessage<
  SendLocalListReqType,
  SendLocalListResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SendLocalListReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const sendLocalListOcppMessage = new SendLocalListOcppMessage(
  "SendLocalList",
  SendLocalListReqSchema,
  SendLocalListResSchema,
);
