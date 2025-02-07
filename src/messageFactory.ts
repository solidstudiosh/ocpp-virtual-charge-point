import * as uuid from "uuid";
import { OcppCall, OcppCallError, OcppCallResult } from "./ocppMessage";

export const call = <T = {}>(action: string, payload: T): OcppCall<T> => {
  return {
    messageId: uuid.v4(),
    action: action,
    payload: payload,
  };
};

export const callResult = <T>(
  call: OcppCall<any>,
  payload: T | {} = {},
): OcppCallResult<any> => {
  return {
    messageId: call.messageId,
    action: call.action,
    payload: payload,
  };
};

export const callError = (
  call: OcppCall<any>,
  payload: any = {},
): OcppCallError<any> => {
  return {
    messageId: call.messageId,
    errorCode: "GenericError",
    errorDescription: "Something went wrong",
    errorDetails: payload,
  };
};
