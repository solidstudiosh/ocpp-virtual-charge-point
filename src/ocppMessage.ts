import { z } from "zod";
import { VCP } from "./vcp";
import { call, callResult } from "./messageFactory";

export interface OcppCall<T = any> {
  messageId: string;
  action: string;
  payload: T;
}

export interface OcppCallResult<T = any> {
  messageId: string;
  action: string;
  payload: T;
}

export interface OcppCallError<T = any> {
  messageId: string;
  errorCode: string;
  errorDescription: string;
  errorDetails?: T;
}

export abstract class OcppMessage<
  ReqSchema extends z.ZodTypeAny,
  ResSchema extends z.ZodTypeAny,
> {
  constructor(
    readonly action: string,
    readonly reqSchema: ReqSchema,
    readonly resSchema: ResSchema,
  ) {}

  reqHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<ReqSchema>>,
  ): Promise<void> => {
    throw new Error("Method not implemented.");
  };

  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<ReqSchema>>,
    _result: OcppCallResult<z.infer<ResSchema>>,
  ): Promise<void> => {
    throw new Error("Method not implemented.");
  };

  request = (payload: z.infer<ReqSchema>): OcppCall<z.infer<ReqSchema>> => {
    return call(this.action, this.requestPayload(payload));
  };

  requestPayload = (payload: z.infer<ReqSchema>): z.infer<ReqSchema> => {
    return this.reqSchema.parse(payload);
  };

  response = (
    call: OcppCall<any>,
    payload: z.infer<ResSchema>,
  ): OcppCallResult<z.infer<ResSchema>> => {
    return callResult(call, this.responsePayload(payload));
  };

  responsePayload = (payload: z.infer<ResSchema>): z.infer<ResSchema> => {
    return this.resSchema.parse(payload);
  };
}
