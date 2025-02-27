import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const ReservationStatusUpdateReqSchema = z.object({
  reservationId: z.number().int(),
  reservationUpdateStatus: z.enum(["Expired", "Removed", "NoTransaction"]),
});
type ReservationStatusUpdateReqType = typeof ReservationStatusUpdateReqSchema;

const ReservationStatusUpdateResSchema = z.object({});
type ReservationStatusUpdateResType = typeof ReservationStatusUpdateResSchema;

class ReservationStatusUpdateOcppOutgoing extends OcppOutgoing<
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

export const reservationStatusUpdateOcppOutgoing =
  new ReservationStatusUpdateOcppOutgoing(
    "ReservationStatusUpdate",
    ReservationStatusUpdateReqSchema,
    ReservationStatusUpdateResSchema,
  );
