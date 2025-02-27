import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const CancelReservationReqSchema = z.object({
  reservationId: z.number().int(),
});
type CancelReservationReqType = typeof CancelReservationReqSchema;

const CancelReservationResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type CancelReservationResType = typeof CancelReservationResSchema;

class CancelReservationOcppMessage extends OcppIncoming<
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

export const cancelReservationOcppMessage = new CancelReservationOcppMessage(
  "CancelReservation",
  CancelReservationReqSchema,
  CancelReservationResSchema,
);
