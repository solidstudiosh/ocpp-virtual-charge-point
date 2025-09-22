import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { MeterValueTypeSchema } from "./_common";

const MeterValuesReqSchema = z.object({
  evseId: z.number().int().nonnegative(),
  meterValue: z.array(MeterValueTypeSchema).nonempty(),
});
type MeterValuesReqType = typeof MeterValuesReqSchema;

const MeterValuesResSchema = z.object({});
type MeterValuesResType = typeof MeterValuesResSchema;

class MeterValuesOcppOutgoing extends OcppOutgoing<
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

export const meterValuesOcppOutgoing = new MeterValuesOcppOutgoing(
  "MeterValues",
  MeterValuesReqSchema,
  MeterValuesResSchema,
);
