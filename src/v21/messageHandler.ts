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
import { adjustPeriodicEventStreamOcppIncoming } from "./messages/adjustPeriodicEventStream";
import { afrrSignalOcppIncoming } from "./messages/afrrSignal";
import { authorizeOcppOutgoing } from "./messages/authorize";
import { batterySwapOcppOutgoing } from "./messages/batterySwap";
import { bootNotificationOcppOutgoing } from "./messages/bootNotification";
import { certificateSignedOcppIncoming } from "./messages/certificateSigned";
import { changeAvailabilityOcppIncoming } from "./messages/changeAvailability";
import { changeTransactionTariffOcppIncoming } from "./messages/changeTransactionTariff";
import { clearCacheOcppIncoming } from "./messages/clearCache";
import { clearChargingProfileOcppIncoming } from "./messages/clearChargingProfile";
import { clearDERControlOcppIncoming } from "./messages/clearDERControl";
import { clearDisplayMessageOcppIncoming } from "./messages/clearDisplayMessage";
import { clearTariffsOcppIncoming } from "./messages/clearTariffs";
import { clearVariableMonitoringOcppIncoming } from "./messages/clearVariableMonitoring";
import { clearedChargingLimitOcppOutgoing } from "./messages/clearedChargingLimit";
import { closePeriodicEventStreamOcppOutgoing } from "./messages/closePeriodicEventStream";
import { costUpdatedOcppIncoming } from "./messages/costUpdated";
import { customerInformationOcppIncoming } from "./messages/customerInformation";
import {
  dataTransferOcppIncoming,
  dataTransferOcppOutgoing,
} from "./messages/dataTransfer";
import { deleteCertificateOcppIncoming } from "./messages/deleteCertificate";
import { firmwareStatusNotificationOcppOutgoing } from "./messages/firmwareStatusNotification";
import { get15118EVCertificateOcppOutgoing } from "./messages/get15118EVCertificate";
import { getBaseReportOcppIncoming } from "./messages/getBaseReport";
import { getCertificateChainStatusOcppOutgoing } from "./messages/getCertificateChainStatus";
import { getCertificateStatusOcppOutgoing } from "./messages/getCertificateStatus";
import { getChargingProfilesOcppIncoming } from "./messages/getChargingProfiles";
import { getCompositeScheduleOcppIncoming } from "./messages/getCompositeSchedule";
import { getDERControlOcppIncoming } from "./messages/getDERControl";
import { getDisplayMessagesOcppIncoming } from "./messages/getDisplayMessages";
import { getInstalledCertificateIdsOcppIncoming } from "./messages/getInstalledCertificateIds";
import { getLocalListVersionOcppIncoming } from "./messages/getLocalListVersion";
import { getLogOcppIncoming } from "./messages/getLog";
import { getMonitoringReportOcppIncoming } from "./messages/getMonitoringReport";
import { getPeriodicEventStreamOcppIncoming } from "./messages/getPeriodicEventStream";
import { getReportOcppIncoming } from "./messages/getReport";
import { getTariffsOcppIncoming } from "./messages/getTariffs";
import { getTransactionStatusOcppIncoming } from "./messages/getTransactionStatus";
import { getVariablesOcppIncoming } from "./messages/getVariables";
import { heartbeatOcppOutgoing } from "./messages/heartbeat";
import { installCertificateOcppIncoming } from "./messages/installCertificate";
import { logStatusNotificationOcppOutgoing } from "./messages/logStatusNotification";
import { meterValuesOcppOutgoing } from "./messages/meterValues";
import { notifyAllowedEnergyTransferOcppIncoming } from "./messages/notifyAllowedEnergyTransfer";
import { notifyChargingLimitOcppOutgoing } from "./messages/notifyChargingLimit";
import { notifyCustomerInformationOcppOutgoing } from "./messages/notifyCustomerInformation";
import { notifyDERAlarmOcppOutgoing } from "./messages/notifyDERAlarm";
import { notifyDERStartStopOcppOutgoing } from "./messages/notifyDERStartStop";
import { notifyDisplayMessagesOcppOutgoing } from "./messages/notifyDisplayMessages";
import { notifyEVChargingNeedsOcppOutgoing } from "./messages/notifyEVChargingNeeds";
import { notifyEVChargingScheduleOcppOutgoing } from "./messages/notifyEVChargingSchedule";
import { notifyEventOcppOutgoing } from "./messages/notifyEvent";
import { notifyMonitoringReportOcppOutgoing } from "./messages/notifyMonitoringReport";
import { notifyPeriodicEventStreamOcppOutgoing } from "./messages/notifyPeriodicEventStream";
import { notifyPriorityChargingOcppOutgoing } from "./messages/notifyPriorityCharging";
import { notifyReportOcppOutgoing } from "./messages/notifyReport";
import { notifySettlementOcppOutgoing } from "./messages/notifySettlement";
import { notifyWebPaymentStartedOcppIncoming } from "./messages/notifyWebPaymentStarted";
import { openPeriodicEventStreamOcppOutgoing } from "./messages/openPeriodicEventStream";
import { publishFirmwareOcppIncoming } from "./messages/publishFirmware";
import { publishFirmwareStatusNotificationOcppOutgoing } from "./messages/publishFirmwareStatusNotification";
import { pullDynamicScheduleUpdateOcppOutgoing } from "./messages/pullDynamicScheduleUpdate";
import { reportChargingProfilesOcppOutgoing } from "./messages/reportChargingProfiles";
import { reportDERControlOcppOutgoing } from "./messages/reportDERControl";
import {
  requestBatterySwapOcppIncoming,
  requestBatterySwapOcppOutgoing,
} from "./messages/requestBatterySwap";
import { requestStartTransactionOcppIncoming } from "./messages/requestStartTransaction";
import { requestStopTransactionOcppIncoming } from "./messages/requestStopTransaction";
import { reservationStatusUpdateOcppOutgoing } from "./messages/reservationStatusUpdate";
import { reserveNowOcppIncoming } from "./messages/reserveNow";
import { resetOcppIncoming } from "./messages/reset";
import { securityEventNotificationOcppOutgoing } from "./messages/securityEventNotification";
import { sendLocalListOcppIncoming } from "./messages/sendLocalList";
import { setChargingProfileOcppIncoming } from "./messages/setChargingProfile";
import { setDERControlOcppIncoming } from "./messages/setDERControl";
import { setDefaultTariffOcppIncoming } from "./messages/setDefaultTariff";
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
import { updateDynamicScheduleOcppIncoming } from "./messages/updateDynamicSchedule";
import { updateFirmwareOcppIncoming } from "./messages/updateFirmware";
import { usePriorityChargingOcppIncoming } from "./messages/usePriorityCharging";
import { vatNumberValidationOcppOutgoing } from "./messages/vatNumberValidation";

// Incoming messages (messages that are received by the CSMS)
export const ocppIncomingMessages: {
  [key: string]: OcppIncoming<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  AdjustPeriodicEventStream: adjustPeriodicEventStreamOcppIncoming,
  AFRRSignal: afrrSignalOcppIncoming,
  CancelReservation: changeAvailabilityOcppIncoming,
  ChangeAvailability: changeAvailabilityOcppIncoming,
  ChangeTransactionTariff: changeTransactionTariffOcppIncoming,
  CertificateSigned: certificateSignedOcppIncoming,
  ClearCache: clearCacheOcppIncoming,
  ClearChargingProfile: clearChargingProfileOcppIncoming,
  ClearDERControl: clearDERControlOcppIncoming,
  ClearDisplayMessage: clearDisplayMessageOcppIncoming,
  ClearTariffs: clearTariffsOcppIncoming,
  ClearVariableMonitoring: clearVariableMonitoringOcppIncoming,
  CostUpdated: costUpdatedOcppIncoming,
  CustomerInformation: customerInformationOcppIncoming,
  DataTransfer: dataTransferOcppIncoming,
  DeleteCertificate: deleteCertificateOcppIncoming,
  GetBaseReport: getBaseReportOcppIncoming,
  GetChargingProfiles: getChargingProfilesOcppIncoming,
  GetCompositeSchedule: getCompositeScheduleOcppIncoming,
  GetDERControl: getDERControlOcppIncoming,
  GetDisplayMessages: getDisplayMessagesOcppIncoming,
  GetInstalledCertificateIds: getInstalledCertificateIdsOcppIncoming,
  GetLocalListVersion: getLocalListVersionOcppIncoming,
  GetLog: getLogOcppIncoming,
  GetMonitoringReport: getMonitoringReportOcppIncoming,
  GetPeriodicEventStream: getPeriodicEventStreamOcppIncoming,
  GetReport: getReportOcppIncoming,
  GetTariffs: getTariffsOcppIncoming,
  GetTransactionStatus: getTransactionStatusOcppIncoming,
  GetVariables: getVariablesOcppIncoming,
  InstallCertificate: installCertificateOcppIncoming,
  NotifyAllowedEnergyTransfer: notifyAllowedEnergyTransferOcppIncoming,
  NotifyWebPaymentStarted: notifyWebPaymentStartedOcppIncoming,
  RequestBatterySwap: requestBatterySwapOcppIncoming,
  PublishFirmware: publishFirmwareOcppIncoming,
  RequestStartTransaction: requestStartTransactionOcppIncoming,
  RequestStopTransaction: requestStopTransactionOcppIncoming,
  ReserveNow: reserveNowOcppIncoming,
  Reset: resetOcppIncoming,
  SendLocalList: sendLocalListOcppIncoming,
  SetChargingProfile: setChargingProfileOcppIncoming,
  SetDefaultTariff: setDefaultTariffOcppIncoming,
  SetDisplayMessage: setDisplayMessageOcppIncoming,
  SetMonitoringBase: setMonitoringBaseOcppIncoming,
  SetMonitoringLevel: setMonitoringLevelOcppIncoming,
  SetNetworkProfile: setNetworkProfileOcppIncoming,
  SetVariableMonitoring: setVariableMonitoringOcppIncoming,
  SetVariables: setVariablesOcppIncoming,
  TriggerMessage: triggerMessageOcppIncoming,
  UnlockConnector: unlockConnectorOcppIncoming,
  UnpublishFirmware: unpublishFirmwareOcppIncoming,
  UpdateDynamicSchedule: updateDynamicScheduleOcppIncoming,
  UpdateFirmware: updateFirmwareOcppIncoming,
  UsePriorityCharging: usePriorityChargingOcppIncoming,
  SetDERControl: setDERControlOcppIncoming,
};

// Outgoing messages (messages that are sent by the CSMS)
export const ocppOutgoingMessages: {
  [key: string]: OcppOutgoing<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  Authorize: authorizeOcppOutgoing,
  BatterySwap: batterySwapOcppOutgoing,
  BootNotification: bootNotificationOcppOutgoing,
  ClearedChargingLimit: clearedChargingLimitOcppOutgoing,
  ClosePeriodicEventStream: closePeriodicEventStreamOcppOutgoing,
  DataTransfer: dataTransferOcppOutgoing,
  FirmwareStatusNotification: firmwareStatusNotificationOcppOutgoing,
  GetCertificateChainStatus: getCertificateChainStatusOcppOutgoing,
  GetCertificateStatus: getCertificateStatusOcppOutgoing,
  Heartbeat: heartbeatOcppOutgoing,
  LogStatusNotification: logStatusNotificationOcppOutgoing,
  MeterValues: meterValuesOcppOutgoing,
  NotifyChargingLimit: notifyChargingLimitOcppOutgoing,
  NotifyCustomerInformation: notifyCustomerInformationOcppOutgoing,
  NotifyDERAlarm: notifyDERAlarmOcppOutgoing,
  NotifyDERStartStop: notifyDERStartStopOcppOutgoing,
  NotifyDisplayMessages: notifyDisplayMessagesOcppOutgoing,
  NotifyEVChargingNeeds: notifyEVChargingNeedsOcppOutgoing,
  NotifyEVChargingSchedule: notifyEVChargingScheduleOcppOutgoing,
  NotifyEvent: notifyEventOcppOutgoing,
  NotifyMonitoringReport: notifyMonitoringReportOcppOutgoing,
  NotifyPeriodicEventStream: notifyPeriodicEventStreamOcppOutgoing,
  NotifyPriorityCharging: notifyPriorityChargingOcppOutgoing,
  NotifyReport: notifyReportOcppOutgoing,
  NotifySettlement: notifySettlementOcppOutgoing,
  OpenPeriodicEventStream: openPeriodicEventStreamOcppOutgoing,
  PublishFirmwareStatusNotification:
    publishFirmwareStatusNotificationOcppOutgoing,
  PullDynamicScheduleUpdate: pullDynamicScheduleUpdateOcppOutgoing,
  ReportChargingProfiles: reportChargingProfilesOcppOutgoing,
  ReportDERControl: reportDERControlOcppOutgoing,
  RequestBatterySwap: requestBatterySwapOcppOutgoing,
  ReservationStatusUpdate: reservationStatusUpdateOcppOutgoing,
  SecurityEventNotification: securityEventNotificationOcppOutgoing,
  SignCertificate: signCertificateOcppOutgoing,
  StatusNotification: statusNotificationOcppOutgoing,
  TransactionEvent: transactionEventOcppOutgoing,
  VatNumberValidation: vatNumberValidationOcppOutgoing,
  Get15118EVCertificate: get15118EVCertificateOcppOutgoing,
};

export const messageHandlerV21: OcppMessageHandler = {
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
