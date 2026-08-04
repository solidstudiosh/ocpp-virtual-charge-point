import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
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

class StopTransactionOcppMessage extends OcppOutgoing<
  StopTransactionReqType,
  StopTransactionResType
> {
  // Callers that cannot know the transactionId assigned by StartTransaction
  // (e.g. admin commands) may send 0 as a placeholder - resolve it as long as
  // there is exactly one ongoing transaction to resolve it to.
  beforeSend = (
    vcp: VCP,
    payload: z.infer<StopTransactionReqType>,
  ): z.infer<StopTransactionReqType> => {
    if (payload?.transactionId !== 0) {
      return payload;
    }
    const transactionId = vcp.transactionManager.onlyTransactionId();
    if (transactionId === undefined) {
      return payload;
    }
    return { ...payload, transactionId: Number(transactionId) };
  };

  resHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<StopTransactionReqType>>,
    _result: OcppCallResult<z.infer<StopTransactionResType>>,
  ): Promise<void> => {
    vcp.transactionManager.stopTransaction(call.payload.transactionId);
  };
}

export const stopTransactionOcppMessage = new StopTransactionOcppMessage(
  "StopTransaction",
  StopTransactionReqSchema,
  StopTransactionResSchema,
);
