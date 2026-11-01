import type { z } from "zod";
import { logger } from "../logger";
import type {
  OcppCall,
  OcppCallError,
  OcppCallResult,
  OcppIncoming,
  OcppOutgoing,
} from "../ocppMessage";
import type { OcppMessageHandler } from "../ocppMessageHandler";
import type { VCP } from "../vcp";
import { authorizeOcppMessage } from "./messages/authorize";
import { bootNotificationOcppMessage } from "./messages/bootNotification";
import { changeAvailabilityOcppMessage } from "./messages/changeAvailability";
import { changeConfigurationOcppMessage } from "./messages/changeConfiguration";
import { clearCacheOcppMessage } from "./messages/clearCache";
import { diagnosticsStatusNotificationOcppMessage } from "./messages/diagnosticsStatusNotification";
import { firmwareStatusNotificationOcppMessage } from "./messages/firmwareStatusNotification";
import { heartbeatOcppMessage } from "./messages/heartbeat";
import { meterValuesOcppMessage } from "./messages/meterValues";
import { remoteStartTransactionOcppMessage } from "./messages/remoteStartTransaction";
import { remoteStopTransactionOcppMessage } from "./messages/remoteStopTransaction";
import { resetOcppMessage } from "./messages/reset";
import { startTransactionOcppMessage } from "./messages/startTransaction";
import { statusNotificationOcppMessage } from "./messages/statusNotification";
import { stopTransactionOcppMessage } from "./messages/stopTransaction";
import { unlockConnectorOcppMessage } from "./messages/unlockConnector";

// GetConfiguration is not an OCPP 1.2 message.
export const ocppIncomingMessages: {
  [key: string]: OcppIncoming<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  ChangeAvailability: changeAvailabilityOcppMessage,
  ChangeConfiguration: changeConfigurationOcppMessage,
  ClearCache: clearCacheOcppMessage,
  RemoteStartTransaction: remoteStartTransactionOcppMessage,
  RemoteStopTransaction: remoteStopTransactionOcppMessage,
  Reset: resetOcppMessage,
  UnlockConnector: unlockConnectorOcppMessage,
};

export const ocppOutgoingMessages: {
  [key: string]: OcppOutgoing<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  Authorize: authorizeOcppMessage,
  BootNotification: bootNotificationOcppMessage,
  DiagnosticsStatusNotification: diagnosticsStatusNotificationOcppMessage,
  FirmwareStatusNotification: firmwareStatusNotificationOcppMessage,
  Heartbeat: heartbeatOcppMessage,
  MeterValues: meterValuesOcppMessage,
  StartTransaction: startTransactionOcppMessage,
  StatusNotification: statusNotificationOcppMessage,
  StopTransaction: stopTransactionOcppMessage,
};

export const messageHandlerV12: OcppMessageHandler = {
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  handleCall: (vcp: VCP, call: OcppCall<any>): void => {
    const ocppMessage = ocppIncomingMessages[call.action];
    if (!ocppMessage) {
      throw new Error(
        `OCPP Incoming Message not implemented for ${call.action}`,
      );
    }
    ocppMessage.reqHandler(vcp, call);
  },
  handleCallResult: (
    vcp: VCP,
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    call: OcppCall<any>,
    // biome-ignore lint/suspicious/noExplicitAny: ocpp types
    result: OcppCallResult<any>,
  ): void => {
    const ocppMessage = ocppOutgoingMessages[result.action];
    if (!ocppMessage) {
      throw new Error(
        `OCPP Outgoing Message not implemented for ${result.action}`,
      );
    }
    ocppMessage.resHandler(vcp, call, result);
  },
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  handleCallError: (_vcp: VCP, error: OcppCallError<any>): void => {
    logger.warn("Received CallError", {
      messageId: error.messageId,
      errorCode: error.errorCode,
      errorDescription: error.errorDescription,
      errorDetails: error.errorDetails,
    });
  },
};
