import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const NotifyDERStartStopReqSchema = z.object({
  controlId: z.string().max(36),
  started: z.boolean(),
  timestamp: z.string().datetime(),
  supersededIds: z.array(z.string().max(36)).nullish(),
});
type NotifyDERStartStopReqType = typeof NotifyDERStartStopReqSchema;

const NotifyDERStartStopResSchema = z.object({});
type NotifyDERStartStopResType = typeof NotifyDERStartStopResSchema;

class NotifyDERStartStopOcppOutgoing extends OcppOutgoing<
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

export const notifyDERStartStopOcppOutgoing =
  new NotifyDERStartStopOcppOutgoing(
    "NotifyDERStartStop",
    NotifyDERStartStopReqSchema,
    NotifyDERStartStopResSchema,
  );
