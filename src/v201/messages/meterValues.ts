import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { MeterValueTypeSchema } from "./_common";

const MeterValuesReqSchema = z.object({
  evseId: z.number().int(),
  meterValue: z.array(MeterValueTypeSchema).nonempty(),
});
type MeterValuesReqType = typeof MeterValuesReqSchema;

const MeterValuesResSchema = z.object({});
type MeterValuesResType = typeof MeterValuesResSchema;

class MeterValuesOcppMessage extends OcppMessage<
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
