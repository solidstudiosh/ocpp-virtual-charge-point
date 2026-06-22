import { logger } from "../logger";
import { callError, callResult } from "../messageFactory";
import type { OcppCall, OcppCallError, OcppCallResult } from "../ocppMessage";
import type { OcppMessageHandler } from "../ocppMessageHandler";
import type { VCP } from "../vcp";
import { messageHandlerV16 } from "../v16/messageHandler";
import { rejectionResponseFor } from "./inboundResponses";

export const replayMessageHandlerV16: OcppMessageHandler = {
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  handleCall: (vcp: VCP, ocppCall: OcppCall<any>): void => {
    const auto = rejectionResponseFor(ocppCall.action);
    if (auto !== null) {
      logger.info(`replay: auto-rejecting incoming ${ocppCall.action}`);
      vcp.respond(callResult(ocppCall, auto));
      return;
    }
    logger.warn(
      `replay: unknown incoming action ${ocppCall.action} → CallError`,
    );
    vcp.respondError({
      ...callError(ocppCall, {}),
      errorCode: "NotImplemented",
      errorDescription: `Action ${ocppCall.action} not handled in replay mode`,
    } as OcppCallError<unknown>);
  },
  handleCallResult: (
    _vcp: VCP,
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    _call: OcppCall<any>,
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    _result: OcppCallResult<any>,
  ): void => {
    // No-op in replay mode. The runner awaits each response via vcp.sendAndAwait
    // and extracts what it needs (transactionId, idTagInfo) directly. Default v16
    // result handlers must NOT run here because StartTransaction's would call
    // transactionManager.startTransaction, kicking off a 15s auto-MeterValues
    // emitter that would interleave synthetic readings with our historical ones.
  },
  handleCallError: messageHandlerV16.handleCallError,
};
