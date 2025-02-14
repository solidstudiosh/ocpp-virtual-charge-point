import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const ClearedChargingLimitReqSchema = z.object({
  chargingLimitSource: z.enum(["EMS", "Other", "SO", "CSO"]),
  evseId: z.number().int().nullish(),
});
type ClearedChargingLimitReqType = typeof ClearedChargingLimitReqSchema;

const ClearedChargingLimitResSchema = z.object({});
type ClearedChargingLimitResType = typeof ClearedChargingLimitResSchema;

class ClearedChargingLimitOcppMessage extends OcppMessage<
  ClearedChargingLimitReqType,
  ClearedChargingLimitResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<ClearedChargingLimitReqType>>,
    _result: OcppCallResult<z.infer<ClearedChargingLimitResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const clearedChargingLimitOcppMessage =
  new ClearedChargingLimitOcppMessage(
    "ClearedChargingLimit",
    ClearedChargingLimitReqSchema,
    ClearedChargingLimitResSchema,
  );
