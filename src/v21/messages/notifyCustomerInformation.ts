import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

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

class NotifyCustomerInformationOcppOutgoing extends OcppOutgoing<
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

export const notifyCustomerInformationOcppOutgoing =
  new NotifyCustomerInformationOcppOutgoing(
    "NotifyCustomerInformation",
    NotifyCustomerInformationReqSchema,
    NotifyCustomerInformationResSchema,
  );
