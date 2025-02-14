import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { transactionManager } from "../transactionManager";
import { IdTagInfoSchema, IdTokenSchema, MeterValueSchema } from "./_common";

const StopTransactionReqSchema = z.object({
  idTag: IdTokenSchema.nullish(),
  meterStop: z.number().int(),
  timestamp: z.string().datetime(),
  transactionId: z.number().int(),
  reason: z
    .enum([
      "DeAuthorized",
      "EmergencyStop",
      "EVDisconnected",
      "HardReset",
      "Local",
      "Other",
      "PowerLoss",
      "Reboot",
      "Remote",
      "SoftReset",
      "UnlockCommand",
    ])
    .nullish(),
  transactionData: z.array(MeterValueSchema).nullish(),
});
type StopTransactionReqType = typeof StopTransactionReqSchema;

const StopTransactionResSchema = z.object({
  idTagInfo: IdTagInfoSchema.nullish(),
});
type StopTransactionResType = typeof StopTransactionResSchema;

class StopTransactionOcppMessage extends OcppMessage<
  StopTransactionReqType,
  StopTransactionResType
> {
  resHandler = async (
    _vcp: VCP,
    call: OcppCall<z.infer<StopTransactionReqType>>,
    _result: OcppCallResult<z.infer<StopTransactionResType>>,
  ): Promise<void> => {
    transactionManager.stopTransaction(call.payload.transactionId);
  };
}

export const stopTransactionOcppMessage = new StopTransactionOcppMessage(
  "StopTransaction",
  StopTransactionReqSchema,
  StopTransactionResSchema,
);
