import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const NotifyCustomerInformationReqSchema = z.object({
  data: z.string().max(512),
  tbc: z.boolean().nullish(),
  seqNo: z.number().int(),
  generatedAt: z.string().datetime(),
  requestId: z.number().int(),
});
type NotifyCustomerInformationReqType =
  typeof NotifyCustomerInformationReqSchema;

const NotifyCustomerInformationResSchema = z.object({});
type NotifyCustomerInformationResType =
  typeof NotifyCustomerInformationResSchema;

class NotifyCustomerInformationOcppMessage extends OcppMessage<
  NotifyCustomerInformationReqType,
  NotifyCustomerInformationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyCustomerInformationReqType>>,
    _result: OcppCallResult<z.infer<NotifyCustomerInformationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyCustomerInformationOcppMessage =
  new NotifyCustomerInformationOcppMessage(
    "NotifyCustomerInformation",
    NotifyCustomerInformationReqSchema,
    NotifyCustomerInformationResSchema,
  );
