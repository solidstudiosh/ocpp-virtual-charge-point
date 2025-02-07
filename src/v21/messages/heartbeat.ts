import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const HeartbeatReqSchema = z.object({});
type HeartbeatReqType = typeof HeartbeatReqSchema;

const HeartbeatResSchema = z.object({
  currentTime: z.string().datetime(),
});
type HeartbeatResType = typeof HeartbeatResSchema;

class HeartbeatOcppMessage extends OcppMessage<
  HeartbeatReqType,
  HeartbeatResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<HeartbeatReqType>>,
    _result: OcppCallResult<z.infer<HeartbeatResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const heartbeatOcppMessage = new HeartbeatOcppMessage(
  "Heartbeat",
  HeartbeatReqSchema,
  HeartbeatResSchema,
);
