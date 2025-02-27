import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  GenericStatusEnumSchema,
  IdTokenTypeSchema,
  StatusInfoTypeSchema,
} from "./_common";

const RequestBatterySwapReqSchema = z.object({
  requestId: z.number().int(),
  idToken: IdTokenTypeSchema,
});
type RequestBatterySwapReqType = typeof RequestBatterySwapReqSchema;

const RequestBatterySwapResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type RequestBatterySwapResType = typeof RequestBatterySwapResSchema;

class RequestBatterySwapOcppOutgoing extends OcppOutgoing<
  RequestBatterySwapReqType,
  RequestBatterySwapResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<RequestBatterySwapReqType>>,
    _result: OcppCallResult<z.infer<RequestBatterySwapResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const requestBatterySwapOcppOutgoing =
  new RequestBatterySwapOcppOutgoing(
    "RequestBatterySwap",
    RequestBatterySwapReqSchema,
    RequestBatterySwapResSchema,
  );
