import type { z } from "zod";
import { logger } from "./logger";
import { call, callResult } from "./messageFactory";
import type { VCP } from "./vcp";

// biome-ignore lint/suspicious/noExplicitAny: ocpp types
export interface OcppCall<T = any> {
  messageId: string;
  action: string;
  payload: T;
}

// biome-ignore lint/suspicious/noExplicitAny: ocpp types
export interface OcppCallResult<T = any> {
  messageId: string;
  action: string;
  payload: T;
}

// biome-ignore lint/suspicious/noExplicitAny: ocpp types
export interface OcppCallError<T = any> {
  messageId: string;
  errorCode: string;
  errorDescription: string;
  errorDetails?: T;
}

export abstract class OcppBase<
  ReqSchema extends z.ZodTypeAny,
  ResSchema extends z.ZodTypeAny,
> {
  constructor(
    readonly action: string,
    readonly reqSchema: ReqSchema,
    readonly resSchema: ResSchema,
  ) {}

  parseRequestPayload = (payload: z.infer<ReqSchema>): z.infer<ReqSchema> => {
    const parseResult = this.reqSchema.safeParse(payload);
    if (parseResult.error) {
      logger.warn("REQUEST payload parsing errors", {
        action: this.action,
        payload: payload,
        errors: JSON.stringify(parseResult.error.issues),
      });
    }
    return parseResult.data;
  };

  parseResponsePayload = (payload: z.infer<ResSchema>): z.infer<ResSchema> => {
    const parseResult = this.resSchema.safeParse(payload);
    if (parseResult.error) {
      logger.warn("RESPONSE payload parsing errors", {
        action: this.action,
        payload: payload,
        errors: JSON.stringify(parseResult.error.issues),
      });
    }
    return parseResult.data;
  };
}

export abstract class OcppIncoming<
  ReqSchema extends z.ZodTypeAny,
  ResSchema extends z.ZodTypeAny,
> extends OcppBase<ReqSchema, ResSchema> {
  abstract reqHandler: (
    _vcp: VCP,
    _call: OcppCall<z.infer<ReqSchema>>,
  ) => Promise<void>;

  response = (
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    call: OcppCall<any>,
    payload: z.infer<ResSchema>,
  ): OcppCallResult<z.infer<ResSchema>> => {
    return callResult(call, this.parseResponsePayload(payload));
  };
}

export abstract class OcppOutgoing<
  ReqSchema extends z.ZodTypeAny,
  ResSchema extends z.ZodTypeAny,
> extends OcppBase<ReqSchema, ResSchema> {
  abstract resHandler: (
    _vcp: VCP,
    _call: OcppCall<z.infer<ReqSchema>>,
    _result: OcppCallResult<z.infer<ResSchema>>,
  ) => Promise<void>;

  request = (payload: z.infer<ReqSchema>): OcppCall<z.infer<ReqSchema>> => {
    return call(this.action, this.parseRequestPayload(payload));
  };
}
