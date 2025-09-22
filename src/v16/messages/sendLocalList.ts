import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { IdTagInfoSchema, IdTokenSchema } from "./_common";

const SendLocalListReqSchema = z
  .object({
    listVersion: z.number().int(),
    localAuthorizationList: z
      .array(
        z.object({
          idTag: IdTokenSchema,
          idTagInfo: IdTagInfoSchema.nullish(),
        }),
      )
      .nullish(),
    updateType: z.enum(["Full", "Differential"]),
  })
  .superRefine((data, ctx) => {
    if (
      data.updateType === "Full" &&
      data.localAuthorizationList?.some((item) => !item.idTagInfo)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "idTagInfo is required when updateType is 'Full'",
        path: ["localAuthorizationList"],
      });
    }
  });
type SendLocalListReqType = typeof SendLocalListReqSchema;

const SendLocalListResSchema = z.object({
  status: z.enum(["Accepted", "Failed", "NotSupported", "VersionMismatch"]),
});
type SendLocalListResType = typeof SendLocalListResSchema;

class SendLocalListOcppMessage extends OcppIncoming<
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
