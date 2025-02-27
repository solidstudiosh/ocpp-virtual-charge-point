import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { IdTokenTypeSchema, StatusInfoTypeSchema } from "./_common";

const ReserveNowReqSchema = z.object({
  id: z.number().int(),
  expiryDateTime: z.string().datetime(),
  connectorType: z
    .enum([
      "cCCS1",
      "cCCS2",
      "cG105",
      "cTesla",
      "cType1",
      "cType2",
      "s309-1P-16A",
      "s309-1P-32A",
      "s309-3P-16A",
      "s309-3P-32A",
      "sBS1361",
      "sCEE-7-7",
      "sType2",
      "sType3",
      "Other1PhMax16A",
      "Other1PhOver16A",
      "Other3Ph",
      "Pan",
      "wInductive",
      "wResonant",
      "Undetermined",
      "Unknown",
    ])
    .nullish(),
  evseId: z.number().int().nullish(),
  idToken: IdTokenTypeSchema,
  groupIdToken: IdTokenTypeSchema.nullish(),
});
type ReserveNowReqType = typeof ReserveNowReqSchema;

const ReserveNowResSchema = z.object({
  status: z.enum([
    "Accepted",
    "Faulted",
    "Occupied",
    "Rejected",
    "Unavailable",
  ]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ReserveNowResType = typeof ReserveNowResSchema;

class ReserveNowOcppIncoming extends OcppIncoming<
  ReserveNowReqType,
  ReserveNowResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ReserveNowReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const reserveNowOcppIncoming = new ReserveNowOcppIncoming(
  "ReserveNow",
  ReserveNowReqSchema,
  ReserveNowResSchema,
);
