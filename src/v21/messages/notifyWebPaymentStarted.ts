import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const NotifyWebPaymentStartedReqSchema = z.object({
  evseId: z.number().int(),
  timeout: z.number().int(),
});
type NotifyWebPaymentStartedReqType = typeof NotifyWebPaymentStartedReqSchema;

const NotifyWebPaymentStartedResSchema = z.object({});
type NotifyWebPaymentStartedResType = typeof NotifyWebPaymentStartedResSchema;

class NotifyWebPaymentStartedOcppIncoming extends OcppIncoming<
  NotifyWebPaymentStartedReqType,
  NotifyWebPaymentStartedResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<NotifyWebPaymentStartedReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, {}));
  };
}

export const notifyWebPaymentStartedOcppIncoming =
  new NotifyWebPaymentStartedOcppIncoming(
    "NotifyWebPaymentStarted",
    NotifyWebPaymentStartedReqSchema,
    NotifyWebPaymentStartedResSchema,
  );
