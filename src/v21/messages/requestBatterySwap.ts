import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppIncoming,
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

class RequestBatterySwapOcppIncoming extends OcppIncoming<
  RequestBatterySwapReqType,
  RequestBatterySwapResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RequestBatterySwapReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const requestBatterySwapOcppIncoming =
  new RequestBatterySwapOcppIncoming(
    "RequestBatterySwap",
    RequestBatterySwapReqSchema,
    RequestBatterySwapResSchema,
  );

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
