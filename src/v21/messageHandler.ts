import { z } from "zod";
import {
  OcppCall,
  OcppCallError,
  OcppCallResult,
  OcppMessage,
} from "../ocppMessage";
import { OcppMessageHandler } from "../ocppMessageHandler";
import { VCP } from "../vcp";
import { adjustPeriodicEventStreamOcppMessage } from "./messages/adjustPeriodicEventStream";
import { afrrSignalOcppMessage } from "./messages/afrrSignal";
import { authorizeOcppMessage } from "./messages/authorize";
import { batterySwapOcppMessage } from "./messages/batterySwap";
import { bootNotificationOcppMessage } from "./messages/bootNotification";
import { cancelReservationOcppMessage } from "./messages/cancelReservation";
import { certificateSignedOcppMessage } from "./messages/certificateSigned";
import { changeAvailabilityOcppMessage } from "./messages/changeAvailability";
import { changeTransactionTariffOcppMessage } from "./messages/changeTransactionTariff";
import { clearCacheOcppMessage } from "./messages/clearCache";
import { clearChargingProfileOcppMessage } from "./messages/clearChargingProfile";
import { clearDERControlOcppMessage } from "./messages/clearDERControl";
import { clearDisplayMessageOcppMessage } from "./messages/clearDisplayMessage";
import { clearedChargingLimitOcppMessage } from "./messages/clearedChargingLimit";
import { clearTariffsOcppMessage } from "./messages/clearTariffs";
import { clearVariableMonitoringOcppMessage } from "./messages/clearVariableMonitoring";
import { closePeriodicEventStreamOcppMessage } from "./messages/closePeriodicEventStream";
import { costUpdatedOcppMessage } from "./messages/costUpdated";
import { customerInformationOcppMessage } from "./messages/customerInformation";
import { dataTransferOcppMessage } from "./messages/dataTransfer";
import { deleteCertificateOcppMessage } from "./messages/deleteCertificate";
import { firmwareStatusNotificationOcppMessage } from "./messages/firmwareStatusNotification";
import { get15118EVCertificateOcppMessage } from "./messages/get15118EVCertificate";
import { getBaseReportOcppMessage } from "./messages/getBaseReport";
import { getCertificateChainStatusOcppMessage } from "./messages/getCertificateChainStatus";
import { getCertificateStatusOcppMessage } from "./messages/getCertificateStatus";
import { getChargingProfilesOcppMessage } from "./messages/getChargingProfiles";
import { getCompositeScheduleOcppMessage } from "./messages/getCompositeSchedule";
import { getDERControlOcppMessage } from "./messages/getDERControl";
import { getDisplayMessagesOcppMessage } from "./messages/getDisplayMessages";
import { getInstalledCertificateIdsOcppMessage } from "./messages/getInstalledCertificateIds";
import { getLocalListVersionOcppMessage } from "./messages/getLocalListVersion";
import { getLogOcppMessage } from "./messages/getLog";
import { getMonitoringReportOcppMessage } from "./messages/getMonitoringReport";
import { getPeriodicEventStreamOcppMessage } from "./messages/getPeriodicEventStream";
import { getReportOcppMessage } from "./messages/getReport";
import { getTariffsOcppMessage } from "./messages/getTariffs";
import { getTransactionStatusOcppMessage } from "./messages/getTransactionStatus";
import { getVariablesOcppMessage } from "./messages/getVariables";
import { heartbeatOcppMessage } from "./messages/heartbeat";
import { installCertificateOcppMessage } from "./messages/installCertificate";
import { logStatusNotificationOcppMessage } from "./messages/logStatusNotification";
import { meterValuesOcppMessage } from "./messages/meterValues";
import { notifyAllowedEnergyTransferOcppMessage } from "./messages/notifyAllowedEnergyTransfer";
import { notifyChargingLimitOcppMessage } from "./messages/notifyChargingLimit";
import { notifyCustomerInformationOcppMessage } from "./messages/notifyCustomerInformation";
import { notifyDERAlarmOcppMessage } from "./messages/notifyDERAlarm";
import { notifyDERStartStopOcppMessage } from "./messages/notifyDERStartStop";
import { notifyDisplayMessagesOcppMessage } from "./messages/notifyDisplayMessages";
import { notifyEVChargingNeedsOcppMessage } from "./messages/notifyEVChargingNeeds";
import { notifyEVChargingScheduleOcppMessage } from "./messages/notifyEVChargingSchedule";
import { notifyEventOcppMessage } from "./messages/notifyEvent";
import { notifyMonitoringReportOcppMessage } from "./messages/notifyMonitoringReport";
import { notifyPeriodicEventStreamOcppMessage } from "./messages/notifyPeriodicEventStream";
import { notifyPriorityChargingOcppMessage } from "./messages/notifyPriorityCharging";
import { notifyReportOcppMessage } from "./messages/notifyReport";
import { notifySettlementOcppMessage } from "./messages/notifySettlement";
import { notifyWebPaymentStartedOcppMessage } from "./messages/notifyWebPaymentStarted";
import { openPeriodicEventStreamOcppMessage } from "./messages/openPeriodicEventStream";
import { publishFirmwareOcppMessage } from "./messages/publishFirmware";
import { publishFirmwareStatusNotificationOcppMessage } from "./messages/publishFirmwareStatusNotification";
import { pullDynamicScheduleUpdateOcppMessage } from "./messages/pullDynamicScheduleUpdate";
import { reportChargingProfilesOcppMessage } from "./messages/reportChargingProfiles";
import { reportDERControlOcppMessage } from "./messages/reportDERControl";
import { requestBatterySwapOcppMessage } from "./messages/requestBatterySwap";
import { requestStartTransactionOcppMessage } from "./messages/requestStartTransaction";
import { requestStopTransactionOcppMessage } from "./messages/requestStopTransaction";
import { reservationStatusUpdateOcppMessage } from "./messages/reservationStatusUpdate";
import { reserveNowOcppMessage } from "./messages/reserveNow";
import { resetOcppMessage } from "./messages/reset";
import { securityEventNotificationOcppMessage } from "./messages/securityEventNotification";
import { sendLocalListOcppMessage } from "./messages/sendLocalList";
import { setChargingProfileOcppMessage } from "./messages/setChargingProfile";
import { setDefaultTariffOcppMessage } from "./messages/setDefaultTariff";
import { setDERControlOcppMessage } from "./messages/setDERControl";
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
import { updateDynamicScheduleOcppMessage } from "./messages/updateDynamicSchedule";
import { updateFirmwareOcppMessage } from "./messages/updateFirmware";
import { usePriorityChargingOcppMessage } from "./messages/usePriorityCharging";
import { vatNumberValidationOcppMessage } from "./messages/vatNumberValidation";

export const ocppMessages: {
  [key: string]: OcppMessage<z.ZodTypeAny, z.ZodTypeAny>;
} = {
  AdjustPeriodicEventStream: adjustPeriodicEventStreamOcppMessage,
  AFRRSignal: afrrSignalOcppMessage,
  Authorize: authorizeOcppMessage,
  BatterySwap: batterySwapOcppMessage,
  BootNotification: bootNotificationOcppMessage,
  CancelReservation: cancelReservationOcppMessage,
  CertificateSigned: certificateSignedOcppMessage,
  ChangeAvailability: changeAvailabilityOcppMessage,
  ChangeTransactionTariff: changeTransactionTariffOcppMessage,
  ClearCache: clearCacheOcppMessage,
  ClearChargingProfile: clearChargingProfileOcppMessage,
  ClearDERControl: clearDERControlOcppMessage,
  ClearDisplayMessage: clearDisplayMessageOcppMessage,
  ClearedChargingLimit: clearedChargingLimitOcppMessage,
  ClearTariffs: clearTariffsOcppMessage,
  ClearVariableMonitoring: clearVariableMonitoringOcppMessage,
  ClosePeriodicEventStream: closePeriodicEventStreamOcppMessage,
  CostUpdated: costUpdatedOcppMessage,
  CustomerInformation: customerInformationOcppMessage,
  DataTransfer: dataTransferOcppMessage,
  DeleteCertificate: deleteCertificateOcppMessage,
  FirmwareStatusNotification: firmwareStatusNotificationOcppMessage,
  Get15118EVCertificate: get15118EVCertificateOcppMessage,
  GetBaseReport: getBaseReportOcppMessage,
  GetCertificateChainStatus: getCertificateChainStatusOcppMessage,
  GetCertificateStatus: getCertificateStatusOcppMessage,
  GetChargingProfiles: getChargingProfilesOcppMessage,
  GetCompositeSchedule: getCompositeScheduleOcppMessage,
  GetDERControl: getDERControlOcppMessage,
  GetDisplayMessages: getDisplayMessagesOcppMessage,
  GetInstalledCertificateIds: getInstalledCertificateIdsOcppMessage,
  GetLocalListVersion: getLocalListVersionOcppMessage,
  GetLog: getLogOcppMessage,
  GetMonitoringReport: getMonitoringReportOcppMessage,
  GetPeriodicEventStream: getPeriodicEventStreamOcppMessage,
  GetReport: getReportOcppMessage,
  GetTariffs: getTariffsOcppMessage,
  GetTransactionStatus: getTransactionStatusOcppMessage,
  GetVariables: getVariablesOcppMessage,
  Heartbeat: heartbeatOcppMessage,
  InstallCertificate: installCertificateOcppMessage,
  LogStatusNotification: logStatusNotificationOcppMessage,
  MeterValues: meterValuesOcppMessage,
  NotifyAllowedEnergyTransfer: notifyAllowedEnergyTransferOcppMessage,
  NotifyChargingLimit: notifyChargingLimitOcppMessage,
  NotifyCustomerInformation: notifyCustomerInformationOcppMessage,
  NotifyDERAlarm: notifyDERAlarmOcppMessage,
  NotifyDERStartStop: notifyDERStartStopOcppMessage,
  NotifyDisplayMessages: notifyDisplayMessagesOcppMessage,
  NotifyEVChargingNeeds: notifyEVChargingNeedsOcppMessage,
  NotifyEVChargingSchedule: notifyEVChargingScheduleOcppMessage,
  NotifyEvent: notifyEventOcppMessage,
  NotifyMonitoringReport: notifyMonitoringReportOcppMessage,
  NotifyPeriodicEventStream: notifyPeriodicEventStreamOcppMessage,
  NotifyPriorityCharging: notifyPriorityChargingOcppMessage,
  NotifyReport: notifyReportOcppMessage,
  NotifySettlement: notifySettlementOcppMessage,
  NotifyWebPaymentStarted: notifyWebPaymentStartedOcppMessage,
  OpenPeriodicEventStream: openPeriodicEventStreamOcppMessage,
  PublishFirmware: publishFirmwareOcppMessage,
  PublishFirmwareStatusNotification:
    publishFirmwareStatusNotificationOcppMessage,
  PullDynamicScheduleUpdate: pullDynamicScheduleUpdateOcppMessage,
  ReportChargingProfiles: reportChargingProfilesOcppMessage,
  ReportDERControl: reportDERControlOcppMessage,
  RequestBatterySwap: requestBatterySwapOcppMessage,
  RequestStartTransaction: requestStartTransactionOcppMessage,
  RequestStopTransaction: requestStopTransactionOcppMessage,
  ReservationStatusUpdate: reservationStatusUpdateOcppMessage,
  ReserveNow: reserveNowOcppMessage,
  Reset: resetOcppMessage,
  SecurityEventNotification: securityEventNotificationOcppMessage,
  SendLocalList: sendLocalListOcppMessage,
  SetChargingProfile: setChargingProfileOcppMessage,
  SetDefaultTariff: setDefaultTariffOcppMessage,
  SetDERControl: setDERControlOcppMessage,
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
  UpdateDynamicSchedule: updateDynamicScheduleOcppMessage,
  UpdateFirmware: updateFirmwareOcppMessage,
  UsePriorityCharging: usePriorityChargingOcppMessage,
  VatNumberValidation: vatNumberValidationOcppMessage,
};

export const messageHandlerV21: OcppMessageHandler = {
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
