import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

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

class NotifyPeriodicEventStreamOcppMessage extends OcppMessage<
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

export const notifyPeriodicEventStreamOcppMessage =
  new NotifyPeriodicEventStreamOcppMessage(
    "NotifyPeriodicEventStream",
    NotifyPeriodicEventStreamReqSchema,
    NotifyPeriodicEventStreamResSchema,
  );
