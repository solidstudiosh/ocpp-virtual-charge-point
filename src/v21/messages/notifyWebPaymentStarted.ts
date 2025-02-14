import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const NotifyWebPaymentStartedReqSchema = z.object({
  evseId: z.number().int(),
  timeout: z.number().int(),
});
type NotifyWebPaymentStartedReqType = typeof NotifyWebPaymentStartedReqSchema;

const NotifyWebPaymentStartedResSchema = z.object({});
type NotifyWebPaymentStartedResType = typeof NotifyWebPaymentStartedResSchema;

class NotifyWebPaymentStartedOcppMessage extends OcppMessage<
  NotifyWebPaymentStartedReqType,
  NotifyWebPaymentStartedResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyWebPaymentStartedReqType>>,
    _result: OcppCallResult<z.infer<NotifyWebPaymentStartedResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyWebPaymentStartedOcppMessage =
  new NotifyWebPaymentStartedOcppMessage(
    "NotifyWebPaymentStarted",
    NotifyWebPaymentStartedReqSchema,
    NotifyWebPaymentStartedResSchema,
  );
