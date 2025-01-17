import { z } from "zod";
import {
  OcppCall,
  OcppCallError,
  OcppCallResult,
  OcppMessage,
} from "../ocppMessage";
import { OcppMessageHandler } from "../ocppMessageHandler";
import { VCP } from "../vcp";
import { authorizeOcppMessage } from "./messages/authorize";
import { bootNotificationOcppMessage } from "./messages/bootNotification";
import { cancelReservationOcppMessage } from "./messages/cancelReservation";
import { changeAvailabilityOcppMessage } from "./messages/changeAvailability";
import { changeConfigurationOcppMessage } from "./messages/changeConfiguration";
import { clearCacheOcppMessage } from "./messages/clearCache";
import { clearChargingProfileOcppMessage } from "./messages/clearChargingProfile";
import { dataTransferOcppMessage } from "./messages/dataTransfer";
import { getConfigurationOcppMessage } from "./messages/getConfiguration";
import { heartbeatOcppMessage } from "./messages/heartbeat";
import { meterValuesOcppMessage } from "./messages/meterValues";
import { remoteStartTransactionOcppMessage } from "./messages/remoteStartTransaction";
import { remoteStopTransactionOcppMessage } from "./messages/remoteStopTransaction";
import { reserveNowOcppMessage } from "./messages/reserveNow";
import { resetOcppMessage } from "./messages/reset";
import { sendLocalListOcppMessage } from "./messages/sendLocalList";
import { setChargingProfileOcppMessage } from "./messages/setChargingProfile";
import { startTransactionOcppMessage } from "./messages/startTransaction";
import { statusNotificationOcppMessage } from "./messages/statusNotification";
import { stopTransactionOcppMessage } from "./messages/stopTransaction";
import { triggerMessageOcppMessage } from "./messages/triggerMessage";
import { unlockConnectorOcppMessage } from "./messages/unlockConnector";
import { updateFirmwareOcppMessage } from "./messages/updateFirmware";
import { diagnosticsStatusNotificationOcppMessage } from "./messages/diagnosticsStatusNotification";
import { firmwareStatusNotificationOcppMessage } from "./messages/firmwareStatusNotification";
import { getCompositeScheduleOcppMessage } from "./messages/getCompositeSchedule";
import { getDiagnosticsOcppMessage } from "./messages/getDiagnostics";
import { getLocalListVersionOcppMessage } from "./messages/getLocalListVersion";
import { certificateSignedOcppMessage } from "./messages/certificateSigned";
import { deleteCertificateOcppMessage } from "./messages/deleteCertificate";
import { extendedTriggerMessageOcppMessage } from "./messages/extendedTriggerMessage";
import { getInstalledCertificateIdsOcppMessage } from "./messages/getInstalledCertificateIds";
import { getLogOcppMessage } from "./messages/getLog";
import { installCertificateOcppMessage } from "./messages/installCertificate";
import { logStatusNotificationOcppMessage } from "./messages/logStatusNotification";
import { signCertificateOcppMessage } from "./messages/signCertificate";
import { signedFirmwareStatusNotificationOcppMessage } from "./messages/signedFirmwareStatusNotification";
import { signedUpdateFirmwareOcppMessage } from "./messages/signedUpdateFirmware";
import { securityEventNotificationOcppMessage } from "./messages/securityEventNotification";

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
  handleCall: function (vcp: VCP, call: OcppCall<any>): void {
    const ocppMessage = ocppMessages[call.action];
    if (!ocppMessage) {
      throw new Error(`OCPP Message not implemented for ${call.action}`);
    }
    ocppMessage.reqHandler(vcp, call);
  },
  handleCallResult: function (
    vcp: VCP,
    call: OcppCall<any>,
    result: OcppCallResult<any>,
  ): void {
    const ocppMessage = ocppMessages[result.action];
    if (!ocppMessage) {
      throw new Error(`OCPP Message not implemented for ${result.action}`);
    }
    ocppMessage.resHandler(vcp, call, result);
  },
  handleCallError: function (vcp: VCP, error: OcppCallError<any>): void {
    // NOOP
  },
};
