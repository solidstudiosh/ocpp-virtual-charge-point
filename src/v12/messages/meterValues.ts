import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, MeterValueSchema } from "./_common";

// No transactionId in 1.2: the central system links the values
// to the connector's ongoing transaction.
const MeterValuesReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  values: z.array(MeterValueSchema).nullish(),
});
type MeterValuesReqType = typeof MeterValuesReqSchema;

const MeterValuesResSchema = z.object({});
type MeterValuesResType = typeof MeterValuesResSchema;

class MeterValuesOcppMessage extends OcppOutgoing<
  MeterValuesReqType,
  MeterValuesResType
> {
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
