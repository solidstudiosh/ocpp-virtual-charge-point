import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const ClearedChargingLimitReqSchema = z.object({
  chargingLimitSource: z.enum(["EMS", "Other", "SO", "CSO"]),
  evseId: z.number().int().nullish(),
});
type ClearedChargingLimitReqType = typeof ClearedChargingLimitReqSchema;

const ClearedChargingLimitResSchema = z.object({});
type ClearedChargingLimitResType = typeof ClearedChargingLimitResSchema;

class ClearedChargingLimitOcppOutgoing extends OcppOutgoing<
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

export const clearedChargingLimitOcppOutgoing =
  new ClearedChargingLimitOcppOutgoing(
    "ClearedChargingLimit",
    ClearedChargingLimitReqSchema,
    ClearedChargingLimitResSchema,
  );
