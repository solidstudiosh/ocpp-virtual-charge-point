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
import { authorizeOcppOutgoing } from "./messages/authorize";
import { bootNotificationOcppOutgoing } from "./messages/bootNotification";
import { cancelReservationOcppOutgoing } from "./messages/cancelReservation";
import { certificateSignedOcppOutgoing } from "./messages/certificateSigned";
import { changeAvailabilityOcppIncoming } from "./messages/changeAvailability";
import { clearCacheOcppIncoming } from "./messages/clearCache";
import { clearChargingProfileOcppIncoming } from "./messages/clearChargingProfile";
import { clearDisplayMessageOcppIncoming } from "./messages/clearDisplayMessage";
import { clearVariableMonitoringOcppIncoming } from "./messages/clearVariableMonitoring";
import { clearedChargingLimitOcppOutgoing } from "./messages/clearedChargingLimit";
import { costUpdatedOcppIncoming } from "./messages/costUpdated";
import { customerInformationOcppIncoming } from "./messages/customerInformation";
import {
  dataTransferIncomingOcppMessage,
  dataTransferOutgoingOcppMessage,
} from "./messages/dataTransfer";
import { deleteCertificateOcppIncoming } from "./messages/deleteCertificate";
import { firmwareStatusNotificationOcppOutgoing } from "./messages/firmwareStatusNotification";
import { get15118EVCertificateOcppIncoming } from "./messages/get15118EVCertificate";
import { getBaseReportOcppIncoming } from "./messages/getBaseReport";
import { getCertificateStatusOcppOutgoing } from "./messages/getCertificateStatus";
import { getChargingProfilesOcppIncoming } from "./messages/getChargingProfiles";
import { getCompositeScheduleOcppIncoming } from "./messages/getCompositeSchedule";
import { getDisplayMessagesOcppIncoming } from "./messages/getDisplayMessages";
import { getInstalledCertificateIdsOcppIncoming } from "./messages/getInstalledCertificateIds";
import { getLocalListVersionOcppIncoming } from "./messages/getLocalListVersion";
import { getLogOcppIncoming } from "./messages/getLog";
import { getMonitoringReportOcppIncoming } from "./messages/getMonitoringReport";
import { getReportOcppIncoming } from "./messages/getReport";
import { getTransactionStatusOcppIncoming } from "./messages/getTransactionStatus";
import { getVariablesOcppIncoming } from "./messages/getVariables";
import { heartbeatOcppOutgoing } from "./messages/heartbeat";
import { installCertificateOcppIncoming } from "./messages/installCertificate";
import { logStatusNotificationOcppOutgoing } from "./messages/logStatusNotification";
import { meterValuesOcppOutgoing } from "./messages/meterValues";
import { notifyChargingLimitOcppOutgoing } from "./messages/notifyChargingLimit";
import { notifyCustomerInformationOcppOutgoing } from "./messages/notifyCustomerInformation";
import { notifyDisplayMessagesOcppOutgoing } from "./messages/notifyDisplayMessages";
import { notifyEVChargingNeedsOcppOutgoing } from "./messages/notifyEVChargingNeeds";
import { notifyEVChargingScheduleOcppOutgoing } from "./messages/notifyEVChargingSchedule";
import { notifyEventOcppOutgoing } from "./messages/notifyEvent";
import { notifyMonitoringReportOcppOutgoing } from "./messages/notifyMonitoringReport";
import { notifyReportOcppOutgoing } from "./messages/notifyReport";
import { publishFirmwareOcppIncoming } from "./messages/publishFirmware";
import { publishFirmwareStatusNotificationOcppOutgoing } from "./messages/publishFirmwareStatusNotification";
import { reportChargingProfilesOcppOutgoing } from "./messages/reportChargingProfiles";
import { requestStartTransactionOcppIncoming } from "./messages/requestStartTransaction";
import { requestStopTransactionOcppIncoming } from "./messages/requestStopTransaction";
import { reservationStatusUpdateOcppOutgoing } from "./messages/reservationStatusUpdate";
import { reserveNowOcppIncoming } from "./messages/reserveNow";
import { resetOcppIncoming } from "./messages/reset";
import { securityEventNotificationOcppOutgoing } from "./messages/securityEventNotification";
import { sendLocalListOcppIncoming } from "./messages/sendLocalList";
import { setChargingProfileOcppIncoming } from "./messages/setChargingProfile";
import { setDisplayMessageOcppIncoming } from "./messages/setDisplayMessage";
import { setMonitoringBaseOcppIncoming } from "./messages/setMonitoringBase";
import { setMonitoringLevelOcppIncoming } from "./messages/setMonitoringLevel";
import { setNetworkProfileOcppIncoming } from "./messages/setNetworkProfile";
import { setVariableMonitoringOcppIncoming } from "./messages/setVariableMonitoring";
import { setVariablesOcppIncoming } from "./messages/setVariables";
import { signCertificateOcppOutgoing } from "./messages/signCertificate";
import { statusNotificationOcppOutgoing } from "./messages/statusNotification";
import { transactionEventOcppOutgoing } from "./messages/transactionEvent";
import { triggerMessageOcppIncoming } from "./messages/triggerMessage";
import { unlockConnectorOcppIncoming } from "./messages/unlockConnector";
import { unpublishFirmwareOcppIncoming } from "./messages/unpublishFirmware";
import { updateFirmwareOcppIncoming } from "./messages/updateFirmware";

export const ocppIncomingMessages: {
  [key: string]: OcppIncoming<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  ChangeAvailability: changeAvailabilityOcppIncoming,
  ClearCache: clearCacheOcppIncoming,
  ClearChargingProfile: clearChargingProfileOcppIncoming,
  ClearDisplayMessage: clearDisplayMessageOcppIncoming,
  ClearVariableMonitoring: clearVariableMonitoringOcppIncoming,
  CostUpdated: costUpdatedOcppIncoming,
  CustomerInformation: customerInformationOcppIncoming,
  DataTransfer: dataTransferIncomingOcppMessage,
  DeleteCertificate: deleteCertificateOcppIncoming,
  Get15118EVCertificate: get15118EVCertificateOcppIncoming,
  GetBaseReport: getBaseReportOcppIncoming,
  GetChargingProfiles: getChargingProfilesOcppIncoming,
  GetCompositeSchedule: getCompositeScheduleOcppIncoming,
  GetDisplayMessages: getDisplayMessagesOcppIncoming,
  GetInstalledCertificateIds: getInstalledCertificateIdsOcppIncoming,
  GetLocalListVersion: getLocalListVersionOcppIncoming,
  GetLog: getLogOcppIncoming,
  GetMonitoringReport: getMonitoringReportOcppIncoming,
  GetReport: getReportOcppIncoming,
  GetTransactionStatus: getTransactionStatusOcppIncoming,
  GetVariables: getVariablesOcppIncoming,
  InstallCertificate: installCertificateOcppIncoming,
  PublishFirmware: publishFirmwareOcppIncoming,
  RequestStartTransaction: requestStartTransactionOcppIncoming,
  RequestStopTransaction: requestStopTransactionOcppIncoming,
  ReserveNow: reserveNowOcppIncoming,
  Reset: resetOcppIncoming,
  SendLocalList: sendLocalListOcppIncoming,
  SetChargingProfile: setChargingProfileOcppIncoming,
  SetDisplayMessage: setDisplayMessageOcppIncoming,
  SetMonitoringBase: setMonitoringBaseOcppIncoming,
  SetMonitoringLevel: setMonitoringLevelOcppIncoming,
  SetNetworkProfile: setNetworkProfileOcppIncoming,
  SetVariableMonitoring: setVariableMonitoringOcppIncoming,
  SetVariables: setVariablesOcppIncoming,
  TriggerMessage: triggerMessageOcppIncoming,
  UnlockConnector: unlockConnectorOcppIncoming,
  UnpublishFirmware: unpublishFirmwareOcppIncoming,
  UpdateFirmware: updateFirmwareOcppIncoming,
};

export const ocppOutgoingMessages: {
  [key: string]: OcppOutgoing<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  Authorize: authorizeOcppOutgoing,
  BootNotification: bootNotificationOcppOutgoing,
  CancelReservation: cancelReservationOcppOutgoing,
  CertificateSigned: certificateSignedOcppOutgoing,
  ClearedChargingLimit: clearedChargingLimitOcppOutgoing,
  DataTransfer: dataTransferOutgoingOcppMessage,
  FirmwareStatusNotification: firmwareStatusNotificationOcppOutgoing,
  GetCertificateStatus: getCertificateStatusOcppOutgoing,
  Heartbeat: heartbeatOcppOutgoing,
  LogStatusNotification: logStatusNotificationOcppOutgoing,
  MeterValues: meterValuesOcppOutgoing,
  NotifyChargingLimit: notifyChargingLimitOcppOutgoing,
  NotifyCustomerInformation: notifyCustomerInformationOcppOutgoing,
  NotifyDisplayMessages: notifyDisplayMessagesOcppOutgoing,
  NotifyEVChargingNeeds: notifyEVChargingNeedsOcppOutgoing,
  NotifyEVChargingSchedule: notifyEVChargingScheduleOcppOutgoing,
  NotifyEvent: notifyEventOcppOutgoing,
  NotifyMonitoringReport: notifyMonitoringReportOcppOutgoing,
  NotifyReport: notifyReportOcppOutgoing,
  PublishFirmwareStatusNotification:
    publishFirmwareStatusNotificationOcppOutgoing,
  ReportChargingProfiles: reportChargingProfilesOcppOutgoing,
  ReservationStatusUpdate: reservationStatusUpdateOcppOutgoing,
  SecurityEventNotification: securityEventNotificationOcppOutgoing,
  SignCertificate: signCertificateOcppOutgoing,
  StatusNotification: statusNotificationOcppOutgoing,
  TransactionEvent: transactionEventOcppOutgoing,
};

export const messageHandlerV201: OcppMessageHandler = {
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
