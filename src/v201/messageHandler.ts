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
import { clearCacheOcppMessage } from "./messages/clearCache";
import { clearChargingProfileOcppMessage } from "./messages/clearChargingProfile";
import { clearDisplayMessageOcppMessage } from "./messages/clearDisplayMessage";
import { clearVariableMonitoringOcppMessage } from "./messages/clearVariableMonitoring";
import { clearedChargingLimitOcppMessage } from "./messages/clearedChargingLimit";
import { costUpdatedOcppMessage } from "./messages/costUpdated";
import { customerInformationOcppMessage } from "./messages/customerInformation";
import { dataTransferOcppMessage } from "./messages/dataTransfer";
import { deleteCertificateOcppMessage } from "./messages/deleteCertificate";
import { firmwareStatusNotificationOcppMessage } from "./messages/firmwareStatusNotification";
import { get15118EVCertificateOcppMessage } from "./messages/get15118EVCertificate";
import { getBaseReportOcppMessage } from "./messages/getBaseReport";
import { getCertificateStatusOcppMessage } from "./messages/getCertificateStatus";
import { getChargingProfilesOcppMessage } from "./messages/getChargingProfiles";
import { getCompositeScheduleOcppMessage } from "./messages/getCompositeSchedule";
import { getDisplayMessagesOcppMessage } from "./messages/getDisplayMessages";
import { getInstalledCertificateIdsOcppMessage } from "./messages/getInstalledCertificateIds";
import { getLocalListVersionOcppMessage } from "./messages/getLocalListVersion";
import { getLogOcppMessage } from "./messages/getLog";
import { getMonitoringReportOcppMessage } from "./messages/getMonitoringReport";
import { getReportOcppMessage } from "./messages/getReport";
import { getTransactionStatusOcppMessage } from "./messages/getTransactionStatus";
import { getVariablesOcppMessage } from "./messages/getVariables";
import { heartbeatOcppMessage } from "./messages/heartbeat";
import { installCertificateOcppMessage } from "./messages/installCertificate";
import { logStatusNotificationOcppMessage } from "./messages/logStatusNotification";
import { meterValuesOcppMessage } from "./messages/meterValues";
import { notifyChargingLimitOcppMessage } from "./messages/notifyChargingLimit";
import { notifyCustomerInformationOcppMessage } from "./messages/notifyCustomerInformation";
import { notifyDisplayMessagesOcppMessage } from "./messages/notifyDisplayMessages";
import { notifyEVChargingNeedsOcppMessage } from "./messages/notifyEVChargingNeeds";
import { notifyEVChargingScheduleOcppMessage } from "./messages/notifyEVChargingSchedule";
import { notifyEventOcppMessage } from "./messages/notifyEvent";
import { notifyMonitoringReportOcppMessage } from "./messages/notifyMonitoringReport";
import { notifyReportOcppMessage } from "./messages/notifyReport";
import { publishFirmwareOcppMessage } from "./messages/publishFirmware";
import { publishFirmwareStatusNotificationOcppMessage } from "./messages/publishFirmwareStatusNotification";
import { reportChargingProfilesOcppMessage } from "./messages/reportChargingProfiles";
import { requestStartTransactionOcppMessage } from "./messages/requestStartTransaction";
import { requestStopTransactionOcppMessage } from "./messages/requestStopTransaction";
import { reservationStatusUpdateOcppMessage } from "./messages/reservationStatusUpdate";
import { reserveNowOcppMessage } from "./messages/reserveNow";
import { resetOcppMessage } from "./messages/reset";
import { securityEventNotificationOcppMessage } from "./messages/securityEventNotification";
import { sendLocalListOcppMessage } from "./messages/sendLocalList";
import { setChargingProfileOcppMessage } from "./messages/setChargingProfile";
import { setDisplayMessageOcppMessage } from "./messages/setDisplayMessage";
import { setMonitoringBaseOcppMessage } from "./messages/setMonitoringBase";
import { setMonitoringLevelOcppMessage } from "./messages/setMonitoringLevel";
import { setNetworkProfileOcppMessage } from "./messages/setNetworkProfile";
import { setVariableMonitoringOcppMessage } from "./messages/setVariableMonitoring";
import { setVariablesOcppMessage } from "./messages/setVariables";
import { signCertificateOcppMessage } from "./messages/signCertificate";
import { statusNotificationOcppMessage } from "./messages/statusNotification";
import { transactionEventOcppMessage } from "./messages/transactionEvent";
import { triggerMessageOcppMessage } from "./messages/triggerMessage";
import { unlockConnectorOcppMessage } from "./messages/unlockConnector";
import { unpublishFirmwareOcppMessage } from "./messages/unpublishFirmware";
import { updateFirmwareOcppMessage } from "./messages/updateFirmware";

export const ocppMessages: {
  [key: string]: OcppMessage<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  Authorize: authorizeOcppMessage,
  BootNotification: bootNotificationOcppMessage,
  CancelReservation: cancelReservationOcppMessage,
  CertificateSigned: certificateSignedOcppMessage,
  ChangeAvailability: changeAvailabilityOcppMessage,
  ClearCache: clearCacheOcppMessage,
  ClearChargingProfile: clearChargingProfileOcppMessage,
  ClearDisplayMessage: clearDisplayMessageOcppMessage,
  ClearedChargingLimit: clearedChargingLimitOcppMessage,
  ClearVariableMonitoring: clearVariableMonitoringOcppMessage,
  CostUpdated: costUpdatedOcppMessage,
  CustomerInformation: customerInformationOcppMessage,
  DataTransfer: dataTransferOcppMessage,
  DeleteCertificate: deleteCertificateOcppMessage,
  FirmwareStatusNotification: firmwareStatusNotificationOcppMessage,
  Get15118EVCertificate: get15118EVCertificateOcppMessage,
  GetBaseReport: getBaseReportOcppMessage,
  GetCertificateStatus: getCertificateStatusOcppMessage,
  GetChargingProfiles: getChargingProfilesOcppMessage,
  GetCompositeSchedule: getCompositeScheduleOcppMessage,
  GetDisplayMessages: getDisplayMessagesOcppMessage,
  GetInstalledCertificateIds: getInstalledCertificateIdsOcppMessage,
  GetLocalListVersion: getLocalListVersionOcppMessage,
  GetLog: getLogOcppMessage,
  GetMonitoringReport: getMonitoringReportOcppMessage,
  GetReport: getReportOcppMessage,
  GetTransactionStatus: getTransactionStatusOcppMessage,
  GetVariables: getVariablesOcppMessage,
  Heartbeat: heartbeatOcppMessage,
  InstallCertificate: installCertificateOcppMessage,
  LogStatusNotification: logStatusNotificationOcppMessage,
  MeterValues: meterValuesOcppMessage,
  NotifyChargingLimit: notifyChargingLimitOcppMessage,
  NotifyCustomerInformation: notifyCustomerInformationOcppMessage,
  NotifyDisplayMessages: notifyDisplayMessagesOcppMessage,
  NotifyEVChargingNeeds: notifyEVChargingNeedsOcppMessage,
  NotifyEVChargingSchedule: notifyEVChargingScheduleOcppMessage,
  NotifyEvent: notifyEventOcppMessage,
  NotifyMonitoringReport: notifyMonitoringReportOcppMessage,
  NotifyReport: notifyReportOcppMessage,
  PublishFirmware: publishFirmwareOcppMessage,
  PublishFirmwareStatusNotification:
    publishFirmwareStatusNotificationOcppMessage,
  ReportChargingProfiles: reportChargingProfilesOcppMessage,
  RequestStartTransaction: requestStartTransactionOcppMessage,
  RequestStopTransaction: requestStopTransactionOcppMessage,
  ReservationStatusUpdate: reservationStatusUpdateOcppMessage,
  ReserveNow: reserveNowOcppMessage,
  Reset: resetOcppMessage,
  SecurityEventNotification: securityEventNotificationOcppMessage,
  SendLocalList: sendLocalListOcppMessage,
  SetChargingProfile: setChargingProfileOcppMessage,
  SetDisplayMessage: setDisplayMessageOcppMessage,
  SetMonitoringBase: setMonitoringBaseOcppMessage,
  SetMonitoringLevel: setMonitoringLevelOcppMessage,
  SetNetworkProfile: setNetworkProfileOcppMessage,
  SetVariableMonitoring: setVariableMonitoringOcppMessage,
  SetVariables: setVariablesOcppMessage,
  SignCertificate: signCertificateOcppMessage,
  StatusNotification: statusNotificationOcppMessage,
  TransactionEvent: transactionEventOcppMessage,
  TriggerMessage: triggerMessageOcppMessage,
  UnlockConnector: unlockConnectorOcppMessage,
  UnpublishFirmware: unpublishFirmwareOcppMessage,
  UpdateFirmware: updateFirmwareOcppMessage,
};

export const messageHandlerV201: OcppMessageHandler = {
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
