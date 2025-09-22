import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, IdTokenSchema } from "./_common";

const ReserveNowReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  expiryDate: z.string().datetime(),
  idTag: IdTokenSchema,
  parentIdTag: IdTokenSchema.nullish(),
  reservationId: z.number().int(),
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
});
type ReserveNowResType = typeof ReserveNowResSchema;

class ReserveNowOcppMessage extends OcppIncoming<
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

export const reserveNowOcppMessage = new ReserveNowOcppMessage(
  "ReserveNow",
  ReserveNowReqSchema,
  ReserveNowResSchema,
);
