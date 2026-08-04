import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, MeterValueSchema } from "./_common";

const MeterValuesReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  transactionId: z.number().int().nullish(),
  meterValue: z.array(MeterValueSchema).nonempty(),
});
type MeterValuesReqType = typeof MeterValuesReqSchema;

const MeterValuesResSchema = z.object({});
type MeterValuesResType = typeof MeterValuesResSchema;

class MeterValuesOcppMessage extends OcppOutgoing<
  MeterValuesReqType,
  MeterValuesResType
> {
  // Callers that cannot know the transactionId assigned by StartTransaction
  // (e.g. admin commands) may send 0 as a placeholder - resolve it as long as
  // there is exactly one ongoing transaction to resolve it to.
  beforeSend = (
    vcp: VCP,
    payload: z.infer<MeterValuesReqType>,
  ): z.infer<MeterValuesReqType> => {
    if (payload.transactionId !== 0) {
      return payload;
    }
    const transactionId = vcp.transactionManager.onlyTransactionId();
    if (transactionId === undefined) {
      return payload;
    }
    return { ...payload, transactionId: Number(transactionId) };
  };

  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<MeterValuesReqType>>,
    _result: OcppCallResult<z.infer<MeterValuesResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const meterValuesOcppMessage = new MeterValuesOcppMessage(
  "MeterValues",
  MeterValuesReqSchema,
  MeterValuesResSchema,
);
