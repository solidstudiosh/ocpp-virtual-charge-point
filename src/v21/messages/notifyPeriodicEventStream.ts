import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const NotifyPeriodicEventStreamReqSchema = z.object({
  id: z.number().int(),
  pending: z.number().int(),
  basetime: z.string().datetime(),
  data: z.array(
    z.object({
      t: z.number(),
      v: z.string().max(2500),
    }),
  ),
});
type NotifyPeriodicEventStreamReqType =
  typeof NotifyPeriodicEventStreamReqSchema;

const NotifyPeriodicEventStreamResSchema = z.object({});
type NotifyPeriodicEventStreamResType =
  typeof NotifyPeriodicEventStreamResSchema;

class NotifyPeriodicEventStreamOcppOutgoing extends OcppOutgoing<
  NotifyPeriodicEventStreamReqType,
  NotifyPeriodicEventStreamResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyPeriodicEventStreamReqType>>,
    _result: OcppCallResult<z.infer<NotifyPeriodicEventStreamResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyPeriodicEventStreamOcppOutgoing =
  new NotifyPeriodicEventStreamOcppOutgoing(
    "NotifyPeriodicEventStream",
    NotifyPeriodicEventStreamReqSchema,
    NotifyPeriodicEventStreamResSchema,
  );
