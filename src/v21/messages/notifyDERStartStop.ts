import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const NotifyDERStartStopReqSchema = z.object({
  controlId: z.string().max(36),
  started: z.boolean(),
  timestamp: z.string().datetime(),
  supersededIds: z.array(z.string().max(36)).nullish(),
});
type NotifyDERStartStopReqType = typeof NotifyDERStartStopReqSchema;

const NotifyDERStartStopResSchema = z.object({});
type NotifyDERStartStopResType = typeof NotifyDERStartStopResSchema;

class NotifyDERStartStopOcppMessage extends OcppMessage<
  NotifyDERStartStopReqType,
  NotifyDERStartStopResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyDERStartStopReqType>>,
    _result: OcppCallResult<z.infer<NotifyDERStartStopResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyDERStartStopOcppMessage = new NotifyDERStartStopOcppMessage(
  "NotifyDERStartStop",
  NotifyDERStartStopReqSchema,
  NotifyDERStartStopResSchema,
);
