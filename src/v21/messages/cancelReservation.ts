import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const CancelReservationReqSchema = z.object({
  reservationId: z.number().int(),
});
type CancelReservationReqType = typeof CancelReservationReqSchema;

const CancelReservationResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type CancelReservationResType = typeof CancelReservationResSchema;

class CancelReservationOcppIncoming extends OcppIncoming<
  CancelReservationReqType,
  CancelReservationResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<CancelReservationReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const cancelReservationOcppIncoming = new CancelReservationOcppIncoming(
  "CancelReservation",
  CancelReservationReqSchema,
  CancelReservationResSchema,
);
