import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { IdTokenTypeSchema } from "./_common";

const BatterySwapReqSchema = z.object({
  eventType: z.enum(["BatteryIn", "BatteryOut", "BatteryOutTimeout"]),
  requestId: z.number().int(),
  idToken: IdTokenTypeSchema,
  batteryData: z.array(
    z.object({
      evseId: z.number().int().nonnegative(),
      serialNumber: z.string().max(50),
      soC: z.number().min(0).max(100),
      soH: z.number().min(0).max(100),
      productionDate: z.string().datetime().nullish(),
      vendorInfo: z.string().max(500).nullish(),
    }),
  ),
});
type BatterySwapReqType = typeof BatterySwapReqSchema;

const BatterySwapResSchema = z.object({});
type BatterySwapResType = typeof BatterySwapResSchema;

class BatterySwapOcppOutgoing extends OcppOutgoing<
  BatterySwapReqType,
  BatterySwapResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<BatterySwapReqType>>,
    _result: OcppCallResult<z.infer<BatterySwapResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const batterySwapOcppOutgoing = new BatterySwapOcppOutgoing(
  "BatterySwap",
  BatterySwapReqSchema,
  BatterySwapResSchema,
);
