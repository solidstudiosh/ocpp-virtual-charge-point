import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { MessageInfoSchema } from "./_common";

const NotifyDisplayMessagesReqSchema = z.object({
  requestId: z.number().int(),
  tbc: z.boolean().nullish(),
  messageInfo: z.array(MessageInfoSchema).nullish(),
});
type NotifyDisplayMessagesReqType = typeof NotifyDisplayMessagesReqSchema;

const NotifyDisplayMessagesResSchema = z.object({});
type NotifyDisplayMessagesResType = typeof NotifyDisplayMessagesResSchema;

class NotifyDisplayMessagesOcppMessage extends OcppMessage<
  NotifyDisplayMessagesReqType,
  NotifyDisplayMessagesResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyDisplayMessagesReqType>>,
    _result: OcppCallResult<z.infer<NotifyDisplayMessagesResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyDisplayMessagesOcppMessage =
  new NotifyDisplayMessagesOcppMessage(
    "NotifyDisplayMessages",
    NotifyDisplayMessagesReqSchema,
    NotifyDisplayMessagesResSchema,
  );
