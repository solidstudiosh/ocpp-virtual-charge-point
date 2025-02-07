import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class RequestBatterySwapOcppMessage extends OcppMessage<
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

export const requestBatterySwapOcppMessage = new RequestBatterySwapOcppMessage(
  "RequestBatterySwap",
  RequestBatterySwapReqSchema,
  RequestBatterySwapResSchema,
);
