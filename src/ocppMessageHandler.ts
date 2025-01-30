import { OcppCall, OcppCallError, OcppCallResult } from "./ocppMessage";
import { OcppVersion } from "./ocppVersion";
import { messageHandlerV16 } from "./v16/messageHandler";
import { messageHandlerV201 } from "./v201/messageHandler";
import { messageHandlerV21 } from "./v21/messageHandler";
import { VCP } from "./vcp";

export type CallHandler = (vcp: VCP, call: OcppCall<any>) => void;
export type CallResultHandler = (
  vcp: VCP,
  call: OcppCall<any>,
  result: OcppCallResult<any>,
) => void;
export type CallErrorHandler = (vcp: VCP, error: OcppCallError<any>) => void;

export interface OcppMessageHandler {
  handleCall: CallHandler;
  handleCallResult: CallResultHandler;
  handleCallError: CallErrorHandler;
}

export const resolveMessageHandler = (
  ocppVersion: OcppVersion,
): OcppMessageHandler => {
  if (ocppVersion === OcppVersion.OCPP_1_6) {
    return messageHandlerV16;
  }
  if (ocppVersion === OcppVersion.OCPP_2_0_1) {
    return messageHandlerV201;
  }
  if (ocppVersion === OcppVersion.OCPP_2_1) {
    return messageHandlerV21;
  }
  throw new Error(`Ocpp message handler not found for version ${ocppVersion}`);
};
