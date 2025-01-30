import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const ReservationStatusUpdateReqSchema = z.object({
  reservationId: z.number().int(),
  reservationUpdateStatus: z.enum(["Expired", "Removed", "NoTransaction"]),
});
type ReservationStatusUpdateReqType = typeof ReservationStatusUpdateReqSchema;

const ReservationStatusUpdateResSchema = z.object({});
type ReservationStatusUpdateResType = typeof ReservationStatusUpdateResSchema;

class ReservationStatusUpdateOcppMessage extends OcppMessage<
  ReservationStatusUpdateReqType,
  ReservationStatusUpdateResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<ReservationStatusUpdateReqType>>,
    _result: OcppCallResult<z.infer<ReservationStatusUpdateResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const reservationStatusUpdateOcppMessage =
  new ReservationStatusUpdateOcppMessage(
    "ReservationStatusUpdate",
    ReservationStatusUpdateReqSchema,
    ReservationStatusUpdateResSchema,
  );
