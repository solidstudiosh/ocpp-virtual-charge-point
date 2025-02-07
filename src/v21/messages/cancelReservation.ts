import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class CancelReservationOcppMessage extends OcppMessage<
  CancelReservationReqType,
  CancelReservationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<CancelReservationReqType>>,
    _result: OcppCallResult<z.infer<CancelReservationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const cancelReservationOcppMessage = new CancelReservationOcppMessage(
  "CancelReservation",
  CancelReservationReqSchema,
  CancelReservationResSchema,
);
