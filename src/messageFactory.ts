import { v4 as uuidv4 } from "uuid";
import type { OcppCall, OcppCallError, OcppCallResult } from "./ocppMessage";

// biome-ignore lint/complexity/noBannedTypes: ocpp types
export const call = <T = {}>(action: string, payload: T): OcppCall<T> => {
  return {
    messageId: uuidv4(),
    action: action,
    payload: payload,
  };
};

export const callResult = <T>(
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  call: OcppCall<any>,
  // biome-ignore lint/complexity/noBannedTypes: ocpp types
  payload: T | {} = {},
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
): OcppCallResult<any> => {
  return {
    messageId: call.messageId,
    action: call.action,
    payload: payload,
  };
};

export const callError = (
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  call: OcppCall<any>,
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  payload: any = {},
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
): OcppCallError<any> => {
  return {
    messageId: call.messageId,
    errorCode: "GenericError",
    errorDescription: "Something went wrong",
    errorDetails: payload,
  };
};
