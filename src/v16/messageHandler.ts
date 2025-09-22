import type { z } from "zod";
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
import { cancelReservationOcppMessage } from "./messages/cancelReservation";
import { certificateSignedOcppMessage } from "./messages/certificateSigned";
import { changeAvailabilityOcppMessage } from "./messages/changeAvailability";
import { changeConfigurationOcppMessage } from "./messages/changeConfiguration";
import { clearCacheOcppMessage } from "./messages/clearCache";
import { clearChargingProfileOcppMessage } from "./messages/clearChargingProfile";
import {
  dataTransferIncomingOcppMessage,
  dataTransferOutgoingOcppMessage,
} from "./messages/dataTransfer";
import { deleteCertificateOcppMessage } from "./messages/deleteCertificate";
import { diagnosticsStatusNotificationOcppMessage } from "./messages/diagnosticsStatusNotification";
import { extendedTriggerMessageOcppMessage } from "./messages/extendedTriggerMessage";
import { firmwareStatusNotificationOcppMessage } from "./messages/firmwareStatusNotification";
import { getCompositeScheduleOcppMessage } from "./messages/getCompositeSchedule";
import { getConfigurationOcppMessage } from "./messages/getConfiguration";
import { getDiagnosticsOcppMessage } from "./messages/getDiagnostics";
import { getInstalledCertificateIdsOcppMessage } from "./messages/getInstalledCertificateIds";
import { getLocalListVersionOcppMessage } from "./messages/getLocalListVersion";
import { getLogOcppMessage } from "./messages/getLog";
import { heartbeatOcppMessage } from "./messages/heartbeat";
import { installCertificateOcppMessage } from "./messages/installCertificate";
import { logStatusNotificationOcppMessage } from "./messages/logStatusNotification";
import { meterValuesOcppMessage } from "./messages/meterValues";
import { remoteStartTransactionOcppMessage } from "./messages/remoteStartTransaction";
import { remoteStopTransactionOcppMessage } from "./messages/remoteStopTransaction";
import { reserveNowOcppMessage } from "./messages/reserveNow";
import { resetOcppMessage } from "./messages/reset";
import { securityEventNotificationOcppMessage } from "./messages/securityEventNotification";
import { sendLocalListOcppMessage } from "./messages/sendLocalList";
import { setChargingProfileOcppMessage } from "./messages/setChargingProfile";
import { signCertificateOcppMessage } from "./messages/signCertificate";
import { signedFirmwareStatusNotificationOcppMessage } from "./messages/signedFirmwareStatusNotification";
import {
  signedUpdateFirmwareIncomingOcppMessage,
  signedUpdateFirmwareOutgoingOcppMessage,
} from "./messages/signedUpdateFirmware";
import { startTransactionOcppMessage } from "./messages/startTransaction";
import { statusNotificationOcppMessage } from "./messages/statusNotification";
import { stopTransactionOcppMessage } from "./messages/stopTransaction";
import { triggerMessageOcppMessage } from "./messages/triggerMessage";
import { unlockConnectorOcppMessage } from "./messages/unlockConnector";
import { updateFirmwareOcppMessage } from "./messages/updateFirmware";

// Collection for incoming messages (used for handleCall)
export const ocppIncomingMessages: {
  [key: string]: OcppIncoming<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  CancelReservation: cancelReservationOcppMessage,
  CertificateSigned: certificateSignedOcppMessage,
  ChangeAvailability: changeAvailabilityOcppMessage,
  ChangeConfiguration: changeConfigurationOcppMessage,
  ClearCache: clearCacheOcppMessage,
  ClearChargingProfile: clearChargingProfileOcppMessage,
  DataTransfer: dataTransferIncomingOcppMessage,
  DeleteCertificate: deleteCertificateOcppMessage,
  ExtendedTriggerMessage: extendedTriggerMessageOcppMessage,
  GetCompositeSchedule: getCompositeScheduleOcppMessage,
  GetConfiguration: getConfigurationOcppMessage,
  GetDiagnostics: getDiagnosticsOcppMessage,
  GetInstalledCertificateIds: getInstalledCertificateIdsOcppMessage,
  GetLocalListVersion: getLocalListVersionOcppMessage,
  GetLog: getLogOcppMessage,
  InstallCertificate: installCertificateOcppMessage,
  RemoteStartTransaction: remoteStartTransactionOcppMessage,
  RemoteStopTransaction: remoteStopTransactionOcppMessage,
  ReserveNow: reserveNowOcppMessage,
  Reset: resetOcppMessage,
  SendLocalList: sendLocalListOcppMessage,
  SetChargingProfile: setChargingProfileOcppMessage,
  SignedUpdateFirmware: signedUpdateFirmwareIncomingOcppMessage,
  TriggerMessage: triggerMessageOcppMessage,
  UnlockConnector: unlockConnectorOcppMessage,
  UpdateFirmware: updateFirmwareOcppMessage,
};

// Collection for outgoing messages (used for handleCallResult)
export const ocppOutgoingMessages: {
  [key: string]: OcppOutgoing<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  Authorize: authorizeOcppMessage,
  BootNotification: bootNotificationOcppMessage,
  DataTransfer: dataTransferOutgoingOcppMessage,
  DiagnosticsStatusNotification: diagnosticsStatusNotificationOcppMessage,
  FirmwareStatusNotification: firmwareStatusNotificationOcppMessage,
  Heartbeat: heartbeatOcppMessage,
  LogStatusNotification: logStatusNotificationOcppMessage,
  MeterValues: meterValuesOcppMessage,
  SecurityEventNotification: securityEventNotificationOcppMessage,
  SignCertificate: signCertificateOcppMessage,
  SignedFirmwareStatusNotification: signedFirmwareStatusNotificationOcppMessage,
  SignedUpdateFirmware: signedUpdateFirmwareOutgoingOcppMessage,
  StartTransaction: startTransactionOcppMessage,
  StatusNotification: statusNotificationOcppMessage,
  StopTransaction: stopTransactionOcppMessage,
};

export const messageHandlerV16: OcppMessageHandler = {
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
  handleCallError: (vcp: VCP, error: OcppCallError<any>): void => {
    // NOOP
  },
};
