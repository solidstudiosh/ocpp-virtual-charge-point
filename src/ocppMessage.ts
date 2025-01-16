import { z } from "zod";
import { VCP } from "./vcp";
import { call, callResult } from "./messageFactory";
import { logger } from "./logger";

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
    return call(this.action, this.parseRequestPayload(payload));
  };

  parseRequestPayload = (payload: z.infer<ReqSchema>): z.infer<ReqSchema> => {
    const parseResult = this.reqSchema.safeParse(payload);
    if (parseResult.error) {
      logger.warn(JSON.stringify(parseResult.error));
    }
    return parseResult.data;
  };

  response = (
    call: OcppCall<any>,
    payload: z.infer<ResSchema>,
  ): OcppCallResult<z.infer<ResSchema>> => {
    return callResult(call, this.parseResponsePayload(payload));
  };

  parseResponsePayload = (payload: z.infer<ResSchema>): z.infer<ResSchema> => {
    const parseResult = this.resSchema.safeParse(payload);
    if (parseResult.error) {
      logger.warn(JSON.stringify(parseResult.error));
    }
    return parseResult.data;
  };
}
