import type { z } from "zod";
import type {
  OcppCall,
  OcppCallError,
  OcppCallResult,
  OcppMessage,
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
import { dataTransferOcppMessage } from "./messages/dataTransfer";
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
import { signedUpdateFirmwareOcppMessage } from "./messages/signedUpdateFirmware";
import { startTransactionOcppMessage } from "./messages/startTransaction";
import { statusNotificationOcppMessage } from "./messages/statusNotification";
import { stopTransactionOcppMessage } from "./messages/stopTransaction";
import { triggerMessageOcppMessage } from "./messages/triggerMessage";
import { unlockConnectorOcppMessage } from "./messages/unlockConnector";
import { updateFirmwareOcppMessage } from "./messages/updateFirmware";

export const ocppMessages: {
  [key: string]: OcppMessage<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  Authorize: authorizeOcppMessage,
  BootNotification: bootNotificationOcppMessage,
  CancelReservation: cancelReservationOcppMessage,
  CertificateSigned: certificateSignedOcppMessage,
  ChangeAvailability: changeAvailabilityOcppMessage,
  ChangeConfiguration: changeConfigurationOcppMessage,
  ClearCache: clearCacheOcppMessage,
  ClearChargingProfile: clearChargingProfileOcppMessage,
  DataTransfer: dataTransferOcppMessage,
  DeleteCertificate: deleteCertificateOcppMessage,
  DiagnosticsStatusNotification: diagnosticsStatusNotificationOcppMessage,
  ExtendedTriggerMessage: extendedTriggerMessageOcppMessage,
  FirmwareStatusNotification: firmwareStatusNotificationOcppMessage,
  GetCompositeSchedule: getCompositeScheduleOcppMessage,
  GetConfiguration: getConfigurationOcppMessage,
  GetDiagnostics: getDiagnosticsOcppMessage,
  GetInstalledCertificateIds: getInstalledCertificateIdsOcppMessage,
  GetLocalListVersion: getLocalListVersionOcppMessage,
  GetLog: getLogOcppMessage,
  Heartbeat: heartbeatOcppMessage,
  InstallCertificate: installCertificateOcppMessage,
  LogStatusNotification: logStatusNotificationOcppMessage,
  MeterValues: meterValuesOcppMessage,
  RemoteStartTransaction: remoteStartTransactionOcppMessage,
  RemoteStopTransaction: remoteStopTransactionOcppMessage,
  ReserveNow: reserveNowOcppMessage,
  Reset: resetOcppMessage,
  SendLocalList: sendLocalListOcppMessage,
  SecurityEventNotification: securityEventNotificationOcppMessage,
  SetChargingProfile: setChargingProfileOcppMessage,
  SignCertificate: signCertificateOcppMessage,
  SignedFirmwareStatusNotification: signedFirmwareStatusNotificationOcppMessage,
  SignedUpdateFirmware: signedUpdateFirmwareOcppMessage,
  StartTransaction: startTransactionOcppMessage,
  StatusNotification: statusNotificationOcppMessage,
  StopTransaction: stopTransactionOcppMessage,
  TriggerMessage: triggerMessageOcppMessage,
  UnlockConnector: unlockConnectorOcppMessage,
  UpdateFirmware: updateFirmwareOcppMessage,
};

export const messageHandlerV16: OcppMessageHandler = {
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  handleCall: (vcp: VCP, call: OcppCall<any>): void => {
    const ocppMessage = ocppMessages[call.action];
    if (!ocppMessage) {
      throw new Error(`OCPP Message not implemented for ${call.action}`);
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
    const ocppMessage = ocppMessages[result.action];
    if (!ocppMessage) {
      throw new Error(`OCPP Message not implemented for ${result.action}`);
    }
    ocppMessage.resHandler(vcp, call, result);
  },
  // biome-ignore lint/suspicious/noExplicitAny: ocpp types
  handleCallError: (vcp: VCP, error: OcppCallError<any>): void => {
    // NOOP
  },
};
