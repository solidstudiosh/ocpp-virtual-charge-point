import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
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

class CancelReservationOcppOutgoing extends OcppOutgoing<
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

export const cancelReservationOcppOutgoing = new CancelReservationOcppOutgoing(
  "CancelReservation",
  CancelReservationReqSchema,
  CancelReservationResSchema,
);
