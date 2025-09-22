import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const ClosePeriodicEventStreamReqSchema = z.object({
  id: z.number().int(),
});
type ClosePeriodicEventStreamReqType = typeof ClosePeriodicEventStreamReqSchema;

const ClosePeriodicEventStreamResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ClosePeriodicEventStreamResType = typeof ClosePeriodicEventStreamResSchema;

class ClosePeriodicEventStreamOcppOutgoing extends OcppOutgoing<
  ClosePeriodicEventStreamReqType,
  ClosePeriodicEventStreamResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<ClosePeriodicEventStreamReqType>>,
    _result: OcppCallResult<z.infer<ClosePeriodicEventStreamResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const closePeriodicEventStreamOcppOutgoing =
  new ClosePeriodicEventStreamOcppOutgoing(
    "ClosePeriodicEventStream",
    ClosePeriodicEventStreamReqSchema,
    ClosePeriodicEventStreamResSchema,
  );
