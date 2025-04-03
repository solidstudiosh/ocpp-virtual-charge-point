import { call as callFactory, callError, callResult } from "../messageFactory";
import { OcppCall, OcppCallError, OcppCallResult } from "../ocppMessage";
import {
  CallHandler,
  CallResultHandler,
  OcppMessageHandler,
} from "../ocppMessageHandler";
import { delay, NOOP } from "../utils";
import { VCP } from "../vcp";
import { transactionManager } from "./transactionManager";
import {
  GetConfigurationReq,
  RemoteStartTransactionReq,
  RemoteStopTransactionReq,
  TriggerMessageReq,
} from "./types";

const callHandlers: { [key: string]: CallHandler } = {
  ClearCache: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  ChangeConfiguration: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  GetConfiguration: (vcp: VCP, call: OcppCall<GetConfigurationReq>) => {
    vcp.respond(
      callResult(call,
        call.payload.key.length > 0 ?
            // ATESS
            // just return 'hidden' atess keys
            JSON.parse('{"configurationKey":[{"key":"G_LowPowerReserveEnable","value":"Disable","readonly":false},{"key":"UnlockConnectorOnEVSideDisconnect","value":"true","readonly":false},{"key":"G_PeriodTime","value":"time1=11:00-16:00&amp;time2=16:01-10:59","readonly":false},{"key":"G_OffPeakEnable","value":"Disable","readonly":false},{"key":"G_OffPeakCurr","value":"","readonly":false},{"key":"G_ChargerNetMac","value":"50:88:C1:3A:23:13","readonly":false},{"key":"AuthorizationCacheEnabled","value":"false","readonly":false},{"key":"AuthorizeRemoteTxRequests","value":"false","readonly":true},{"key":"ConnectionTimeOut","value":"90","readonly":false},{"key":"LocalAuthListEnabled","value":"false","readonly":false},{"key":"LocalAuthorizeOffline","value":"false","readonly":false},{"key":"LocalPreAuthorize","value":"false","readonly":false},{"key":"StopTransactionOnInvalidId","value":"true","readonly":false}]}')
        :
            // return all keys
            JSON.parse('{"configurationKey":[{"key":"G_ChargerID","value":"IOG0B21174","readonly":false},{"key":"G_ChargerRate","value":"1.00","readonly":false},{"key":"G_ChargerLanguage","value":"English","readonly":false},{"key":"G_MaxCurrent","value":"32.00","readonly":false},{"key":"G_ChargerMode","value":"1","readonly":false},{"key":"G_CardPin","value":"242007","readonly":false},{"key":"G_Authentication","value":"12354678","readonly":false},{"key":"G_ChargerNetIP","value":"192.168.1.5","readonly":false},{"key":"G_MaxTemperature","value":"85","readonly":false},{"key":"G_ExternalLimitPower","value":"45","readonly":false},{"key":"G_ExternalLimitPowerEnable","value":"0","readonly":false},{"key":"G_ExternalSamplingCurWring","value":"0","readonly":false},{"key":"G_SolarMode","value":"0","readonly":false},{"key":"G_SolarLimitPower","value":"1.76","readonly":false},{"key":"G_PeakValleyEnable","value":"1","readonly":false},{"key":"G_AutoChargeTime","value":"00:00-00:00","readonly":false},{"key":"G_RCDProtection","value":"6","readonly":false},{"key":"G_PowerMeterAddr","value":"1","readonly":false},{"key":"G_PowerMeterType","value":"Acrel DDS1352","readonly":false},{"key":"G_TimeZone","value":"UTC+00:00","readonly":false},{"key":"G_ServerURL","value":"ws://ocpp.electricmiles.io/","readonly":false},{"key":"G_RandDelayChargeTime","value":"600","readonly":false},{"key":"HeartbeatInterval","value":"300","readonly":false},{"key":"MeterValueSampleInterval","value":"60","readonly":false},{"key":"WebSocketPingInterval","value":"30","readonly":false},{"key":"ConnectionTimeOut","value":"90","readonly":false},{"key":"LocalAuthorizeOffline","value":"false","readonly":false},{"key":"AuthorizationCacheEnabled","value":"false","readonly":false},{"key":"LocalPreAuthorize","value":"false","readonly":false},{"key":"LocalAuthListEnabled","value":"false","readonly":false},{"key":"AuthorizeRemoteTxRequests","value":"false","readonly":false}]}')
          // keba KC-P30
          //JSON.parse('{"configurationKey":[{"key":"PVEnable","readonly":false,"value":"false"},{"key":"PVMinShare","readonly":false,"value":"0"},{"key":"PVPreChargeTime","readonly":false,"value":"0"},{"key":"PVIgnoreX1","readonly":false,"value":"false"},{"key":"PVThresholdImport","readonly":false,"value":"400000"},{"key":"PVThresholdExport","readonly":false,"value":"400000"},{"key":"PVDelay","readonly":false,"value":"300"},{"key":"MaxAvailableCurrent","readonly":false,"value":"100000"},{"key":"MaxDurationChargingPause","readonly":false,"value":"900"},{"key":"NominalVoltage","readonly":false,"value":"230"},{"key":"MaximumAsymmetricLoadCurrent","readonly":false,"value":"0"},{"key":"AsymmNetworkEnabled","readonly":false,"value":"false"},{"key":"AsymmNetworkCheckerTaskInitialDelay","readonly":false,"value":"15"},{"key":"AsymmNetworkCheckerTaskRetryInterval","readonly":false,"value":"10"},{"key":"PowerControlThreshold","readonly":false,"value":"1000"},{"key":"TimeSynchronizationTolerance","readonly":false,"value":"30"},{"key":"PwmMinCurrentDefault","readonly":false,"value":"6000"},{"key":"ChargeProfileMaxStackLevel","readonly":true,"value":"32"},{"key":"ChargingScheduleAllowedChargingRateUnit","readonly":true,"value":"Current"},{"key":"ChargingScheduleMaxPeriods","readonly":true,"value":"32"},{"key":"MaxChargingProfilesInstalled","readonly":true,"value":"64"},{"key":"DelayAfterInitialCalculation","readonly":true,"value":"30"},{"key":"ConnectionTimeOut","readonly":false,"value":"60"},{"key":"UpdateFirmwareChecksumCheckActivated","readonly":false,"value":"false"},{"key":"ClockAlignedDataInterval","readonly":false,"value":"900"},{"key":"HostConnectorExternalMeterInterval","readonly":false,"value":"180"},{"key":"HostConnectorClockAlignedDelayPerc","readonly":false,"value":"0"},{"key":"MeasurementUpdateEvtInterval","readonly":false,"value":"30"},{"key":"MeterValueSampleInterval","readonly":false,"value":"60"},{"key":"HostConnectorMeterValueSendInterval","readonly":false,"value":"60"},{"key":"MeterValuesExternalData","readonly":false,"value":"Energy.Active.Import.Register, Energy.Active.Export.Register"},{"key":"HostConnectorSendStateChangeMeterValues","readonly":false,"value":"false"},{"key":"MeasurementUpdateEvtCurrentThreshold","readonly":false,"value":"1000"},{"key":"AuthorizationEnabled","readonly":false,"value":"false"},{"key":"AuthorizationModeOnline","readonly":false,"value":"FirstLocal"},{"key":"AuthorizationModeOffline","readonly":false,"value":"OfflineLocalAuthorization"},{"key":"LocalPreAuthorize","readonly":false,"value":"true"},{"key":"LocalAuthorizeOffline","readonly":false,"value":"true"},{"key":"AllowOfflineTxForUnknownId","readonly":false,"value":"false"},{"key":"LocalAuthListEnabled","readonly":true,"value":"true"},{"key":"LocalAuthListMaxLength","readonly":true,"value":"1024"},{"key":"SendLocalListMaxLength","readonly":true,"value":"1024"},{"key":"ResumeSessionAfterPowerCut","readonly":false,"value":"true"},{"key":"Price","readonly":false,"value":"0.0"},{"key":"PreauthorizedAmount","readonly":false,"value":"0.0"},{"key":"DirectPaymentLegalText","readonly":false,"value":""},{"key":"DirectPaymentAllowedFilenames","readonly":true,"value":"qrcode.png,qrcode.gif,standby.mp4,standby.jpg,standby.gif,standby.png,startscreen.png,startscreen.gif,startscreen.jpg,startscreen.mp4,whitelabel.zip"},{"key":"DirectPaymentMaxFileSize","readonly":true,"value":"10"},{"key":"DirectPaymentTariffModel","readonly":false,"value":"PerEnergyConsumed"},{"key":"DirectPaymentStartFee","readonly":false,"value":"0.0"},{"key":"ChargepointLocation","readonly":false,"value":""},{"key":"PaymentTerminalPwd","readonly":false,"value":"****"},{"key":"DirectPaymentContactPhone","readonly":false,"value":"08001234456"},{"key":"DirectPaymentContactEmail","readonly":false,"value":"support@keba.com"},{"key":"DirectPaymentNameOnReceipt","readonly":false,"value":"KEBA AG"},{"key":"DirectPaymentBlockingFee","readonly":false,"value":"0.0"},{"key":"DirectPaymentBlockingFeeTime","readonly":false,"value":"0.0"},{"key":"DirectPaymentBlockingFeeTimeUnit","readonly":false,"value":"min"},{"key":"DirectPaymentBlockingFeeRunningTime","readonly":false,"value":"0.0"},{"key":"DirectPaymentBlockingFeeRunningTimeTimeUnit","readonly":false,"value":"min"},{"key":"ExternalMeterSendInterval","readonly":false,"value":"5"},{"key":"MaxDaysOfLogs","readonly":false,"value":"90"},{"key":"LogLevelDebug","readonly":false,"value":"false"},{"key":"LogLevelDebugTime","readonly":false,"value":"3"},{"key":"ConnectorPhaseRotation","readonly":false,"value":"1.Rxx"},{"key":"PermanentlyLocked","readonly":false,"value":"1.false"},{"key":"ExternalMeterHomegridProviders","readonly":false,"value":"ABB | M4M,TQ-Systems | EM420 compatible,Siemens | 7KT1260,KOSTAL | KSEM,KeContact E10,Carlo Gavazzi | EM 24,Fronius Smart Meter TS 65A via Symo GEN24,Gossen Metrawatt | EMX228X/EM238X,Herholdt | ECSEM113,Janitza | ECSEM114MID,ABB | B23312-100,Janitza | B23312-10J,Leviton | S3500,Siemens | 7KM2200"},{"key":"HostConnectorType","readonly":true,"value":"OCPP_16_JSON"},{"key":"HeartBeatInterval","readonly":false,"value":"600"},{"key":"HeartbeatNoOfRetries","readonly":false,"value":"15"},{"key":"HostConnectorRetryInterval","readonly":false,"value":"60"},{"key":"TransactionMessageAttempts","readonly":false,"value":"720"},{"key":"TransactionMessageRetryInterval","readonly":false,"value":"60"},{"key":"HostConnectorDurationMessageStorage","readonly":false,"value":"43200"},{"key":"HostConnectorSendMeterValuesImmediately","readonly":false,"value":"true"},{"key":"HostConnectorSendClockAlignedExternalMeter","readonly":false,"value":"false"},{"key":"TimeDateSyncMethod","readonly":false,"value":"Automatic"},{"key":"HostConnectorTimezone","readonly":false,"value":"Etc/UTC"},{"key":"TimeZone","readonly":false,"value":"Europe/Vienna"},{"key":"HostConnectorUseCentralTime","readonly":false,"value":"true"},{"key":"HostConnectorReconnectInterval","readonly":false,"value":"30"},{"key":"SetSecureIncomingConnection","readonly":false,"value":"false"},{"key":"SetSecureOutgoingConnection","readonly":false,"value":"false"},{"key":"DisableCertificateValidation","readonly":false,"value":"false"},{"key":"DisableHostnameVerification","readonly":false,"value":"false"},{"key":"TruststorePath","readonly":true,"value":""},{"key":"TruststorePassword","readonly":true,"value":"cs/cHLtx/03xpQblnJcZgQ=="},{"key":"ChargeBoxIdentity","readonly":false,"value":"27017327"},{"key":"CentralSystemAddress","readonly":false,"value":"ocpp.test.electricmiles.io"},{"key":"CentralSystemPort","readonly":false,"value":"80"},{"key":"CentralSystemPath","readonly":false,"value":""},{"key":"HostConnectorCentralSystemAuthorizationMethod","readonly":false,"value":"None"},{"key":"HostConnectorCentralSystemUserId","readonly":false,"value":""},{"key":"HostConnectorCentralSystemPassword","readonly":false,"value":""},{"key":"HostConnectorCentralSystemConnectTimeout","readonly":false,"value":"60"},{"key":"HostConnectorCentralSystemReadTimeout","readonly":false,"value":"60"},{"key":"ChargepointAddress","readonly":false,"value":"localhost"},{"key":"ChargepointPort","readonly":false,"value":"12801"},{"key":"HostConnectorChargepointPreferredInterface","readonly":false,"value":"eth0"},{"key":"HostConnectorChargepointServiceAuthorizationMethod","readonly":false,"value":"None"},{"key":"HostConnectorChargepointServiceUserId","readonly":false,"value":""},{"key":"HostConnectorChargepointServicePassword","readonly":false,"value":""},{"key":"OcppChargepointServiceInitRetryPeriodInSeconds","readonly":false,"value":"30"},{"key":"StopTransactionOnInvalidId","readonly":false,"value":"true"},{"key":"DefaultTokenID","readonly":false,"value":"predefinedTokenId"},{"key":"WebSocketPingInterval","readonly":false,"value":"0"},{"key":"AuthorizationKey","readonly":false,"value":"DummyAuthorizationKey"},{"key":"AmountConnectors","readonly":false,"value":"1"},{"key":"NumberOfConnectors","readonly":false,"value":"1"},{"key":"ExternalMeterHomegridConfigured","readonly":false,"value":"false"},{"key":"ExternalMeterHomegridIpAddress","readonly":false,"value":""},{"key":"ExternalMeterHomegridPort","readonly":false,"value":""},{"key":"ExternalMeterHomegridProvider","readonly":false,"value":""},{"key":"ExternalMeterHomegridUnit","readonly":false,"value":""},{"key":"ExternalMeterHomegridImax1","readonly":false,"value":""},{"key":"ExternalMeterHomegridImax2","readonly":false,"value":""},{"key":"ExternalMeterHomegridImax3","readonly":false,"value":""},{"key":"ExternalMeterHomegridPmax","readonly":false,"value":""},{"key":"ExternalMeterHomegridComLost","readonly":false,"value":""},{"key":"ExternalMeterHomegridDurationForIncrease","readonly":false,"value":"300"},{"key":"ExternalMeterHomegridDurationForDecrease","readonly":false,"value":"10"},{"key":"ExternalMeterHomegridLMGMTEnabled","readonly":false,"value":"true"},{"key":"ChargePointModel","readonly":true,"value":"KC-P30-GS2400U2-M0A"},{"key":"ChargePointSerialNumber","readonly":true,"value":"27017327"},{"key":"FirmwareVersion","readonly":true,"value":"1.18.0"},{"key":"RemoteServiceInterface","readonly":false,"value":"true"},{"key":"GsmSimPin","readonly":false,"value":""},{"key":"GsmApn","readonly":false,"value":"a1.net"},{"key":"GsmApnUsername","readonly":false,"value":"ppp@A1plus.at"},{"key":"GsmApnPassword","readonly":false,"value":"ppp"},{"key":"GsmClientEnabled","readonly":false,"value":"false"},{"key":"AuthorizeRemoteTxRequests","readonly":true,"value":"false"},{"key":"GetConfigurationMaxKeys","readonly":true,"value":"200"},{"key":"SupportedFeatureProfiles","readonly":true,"value":"Core,FirmwareManagement,LocalAuthListManagement,Reservation,SmartCharging,RemoteTrigger"},{"key":"StopTxnAlignedData","readonly":false,"value":"Energy.Active.Import.Register"},{"key":"StopTxnSampledData","readonly":false,"value":"Energy.Active.Import.Register"},{"key":"MeterValuesAlignedData","readonly":false,"value":"Energy.Active.Import.Register"},{"key":"MeterValuesSampledData","readonly":false,"value":"Energy.Active.Import.Register"},{"key":"UnlockConnectorOnEVSideDisconnect","readonly":true,"value":"true"},{"key":"StopTransactionOnEVSideDisconnect","readonly":true,"value":"true"},{"key":"ResetRetries","readonly":true,"value":"0"},{"key":"ConnectorSwitch3to1PhaseSupported","readonly":false,"value":"false"},{"key":"ConnectorSwitchPhaseSource","readonly":false,"value":"NONE"},{"key":"ReserveConnectorZeroSupported","readonly":true,"value":"false"},{"key":"KeystorePassword","readonly":true,"value":"hsaaNnRAnGgdZBAki/b5pQ=="},{"key":"CertificateStoreMaxLength","readonly":true,"value":"10000"},{"key":"AdditionalRootCertificateCheck","readonly":false,"value":"false"},{"key":"SupportedFileTransferProtocols","readonly":true,"value":"FTP,HTTP,HTTPS"},{"key":"GetCertificateHashAlgorithm","readonly":false,"value":"SHA256"},{"key":"DaysUntilChargepointCertificateExpiration","readonly":false,"value":"30"},{"key":"CpoName","readonly":false,"value":"Keba"},{"key":"SecurityProfile","readonly":false,"value":"0"},{"key":"SecurityProfileFallback","readonly":false,"value":"0"},{"key":"SecurityProfileFallbackPeriod","readonly":false,"value":"180"},{"key":"MemoryCheckerThresholdPct","readonly":true,"value":"90"},{"key":"BatchedEventPauseResetAfter","readonly":true,"value":"30"},{"key":"PortalHost","readonly":false,"value":""},{"key":"PortalPort","readonly":false,"value":""},{"key":"PortalPath","readonly":false,"value":""},{"key":"PortalChargeBoxIdentity","readonly":false,"value":"27017327"},{"key":"enc.PortalBasicAuthenticationPassword","readonly":false,"value":"7EOpRa5669/xpQblnJcZgQ=="},{"key":"PortalWebSocketPingInterval","readonly":false,"value":"240"},{"key":"enc.PortalEnrollmentToken","readonly":false,"value":""},{"key":"PortalUpdateEndpoint","readonly":false,"value":"https://emobility-portal-backend.keba.com/update/api/v1"},{"key":"PortalUpdateCheckFrequencyDays","readonly":false,"value":"1"},{"key":"DisplayTextLanguage","readonly":false,"value":"en"},{"key":"DisplayTextCard","readonly":false,"value":"\'en\',\'$      Swipe card\',0,5,5"},{"key":"DisplayTextPlug","readonly":false,"value":"\'en\',\'Insert plug\',0,5,5"},{"key":"DisplayTextCheckingCard","readonly":false,"value":"\'en\',\'...\',0,0,0"},{"key":"DisplayTextCardExpired","readonly":false,"value":"\'en\',\'EXPIRED card\',1,3,0"},{"key":"DisplayTextCardBlocked","readonly":false,"value":"\'en\',\'BLOCKED card\',1,3,0"},{"key":"DisplayTextCardInvalid","readonly":false,"value":"\'en\',\'INVALID card\',1,3,0"},{"key":"DisplayTextCardOk","readonly":false,"value":"\'en\',\'ACCEPTED card\',1,3,0"},{"key":"DisplayTextCharging","readonly":false,"value":"\'en\',\'Charging...\',1,10,0"},{"key":"DisplayTextPVBoostCharging","readonly":false,"value":"\'en\',\'Boost charge\',1,10,0"},{"key":"DisplayTextPVCharging","readonly":false,"value":"\'en\',\'PV charging\',1,10,0"},{"key":"DisplayTextChargingSuspended","readonly":false,"value":"\'en\',\'Charging suspended\',1,10,0"},{"key":"DisplayTextChargingStopped","readonly":false,"value":"\'en\',\'Charging stopped\',5,10,0"},{"key":"DisplayTextReservedId","readonly":false,"value":"\'en\',\'Reserved ID {0}\',0,5,5"},{"key":"DisplayTextWrongReservation","readonly":false,"value":"\'en\',\'Wrong reservation\',1,3,0"},{"key":"RandomProfileDelayEnabled","readonly":false,"value":"true"},{"key":"RandomProfileMaxDelay","readonly":false,"value":"600"},{"key":"FtpUseMlstCommand","readonly":false,"value":"true"},{"key":"FtpsUseEndpointChecking","readonly":false,"value":"true"},{"key":"SftpUseStrictHostChecking","readonly":false,"value":"false"},{"key":"RestApiEnabled","readonly":false,"value":"true"},{"key":"PortalConfigNotificationEnabled","readonly":false,"value":"false"},{"key":"PortalConfigNotificationFrequency","readonly":false,"value":"30"},{"key":"HostConnectorProxyServerAddress","readonly":false,"value":""},{"key":"HostConnectorProxyServerPort","readonly":false,"value":""},{"key":"HostConnectorProxyUsername","readonly":false,"value":""},{"key":"HostConnectorProxyPassword","readonly":false,"value":""},{"key":"HostConnectorProxyServerConfigEnabled","readonly":false,"value":"false"},{"key":"Connect2ConnectorSerial1","readonly":false,"value":"27017327"},{"key":"FailsafeCurrentSerial1","readonly":false,"value":"32000"},{"key":"ModelSerial1","readonly":true,"value":"KC-P30-GS2400U2-M0A"},{"key":"MaxCurrentSerial1","readonly":true,"value":"10000"},{"key":"AliasSerial1","readonly":false,"value":""}],"unknownKey":[]}')
      )
    );
  },
  Reset: async (vcp: VCP, call: OcppCall) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
    await delay(3000);
    vcp.close();
  },
  SetChargingProfile: (vcp: VCP, call: OcppCall) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  ClearChargingProfile: (vcp: VCP, call: OcppCall) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  RemoteStartTransaction: (
    vcp: VCP,
    call: OcppCall<RemoteStartTransactionReq>
  ) => {
    if (!call.payload.connectorId) {
      vcp.respond(callResult(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(callResult(call, { status: "Accepted" }));
    vcp.send(
      callFactory("StartTransaction", {
        connectorId: call.payload.connectorId,
        idTag: call.payload.idTag,
        meterStart: parseInt(process.env["INITIAL_METER_READINGS"] ?? '0'),
        timestamp: new Date(),
      })
    );
    vcp.send(
      callFactory("StatusNotification", {
        connectorId: call.payload.connectorId,
        errorCode: "NoError",
        status: "Charging",
      })
    );
  },
  RemoteStopTransaction: (
    vcp: VCP,
    call: OcppCall<RemoteStopTransactionReq>
  ) => {
    const transactionId = call.payload.transactionId;
    const transaction = transactionManager.transactions.get(
      transactionId.toString()
    );
    if (!transaction) {
      vcp.respond(callResult(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(callResult(call, { status: "Accepted" }));
    vcp.send(
      callFactory("StopTransaction", {
        transactionId: transactionId,
        meterStop: Math.floor(
          transactionManager.getMeterValue(transactionId)
        ),
        timestamp: new Date(),
      })
    );
    vcp.send(
      callFactory("StatusNotification", {
        connectorId: transaction.connectorId,
        errorCode: "NoError",
        status: "Finishing",
      })
    );
  },
  ReserveNow: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  CancelReservation: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  UnlockConnector: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Unlocked" }));
  },
  TriggerMessage: (vcp: VCP, call: OcppCall<TriggerMessageReq>) => {
    if (call.payload.requestedMessage === "StatusNotification") {
      vcp.respond(callResult(call, { status: "Accepted" }));
    } else {
      vcp.respond(callResult(call, { status: "NotImplemented" }));
    }
  },
  ChangeAvailability: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  DataTransfer: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
};

const callResultHandlers: { [key: string]: CallResultHandler } = {
  BootNotification: (
    vcp: VCP,
    _call: OcppCall<any>,
    _result: OcppCallResult<any>
  ) => {
    vcp.configureHeartbeat(300_000);
  },
  MeterValues: NOOP,
  Heartbeat: NOOP,
  StatusNotification: NOOP,
  StartTransaction: (
    vcp: VCP,
    call: OcppCall<any>,
    result: OcppCallResult<any>
  ) => {
    transactionManager.startTransaction(
      vcp,
      result.payload.transactionId,
      call.payload.connectorId
    );
  },
  StopTransaction: (
    _vcp: VCP,
    call: OcppCall<any>,
    _result: OcppCallResult<any>
  ) => {
    transactionManager.stopTransaction(call.payload.transactionId);
  },
  SecurityEventNotification: (
      _vcp: VCP,
      call: OcppCall<any>,
      _result: OcppCallResult<any>
  ) => {
  },
  Authorize: NOOP,
  DataTransfer: NOOP,
};

export const messageHandlerV16: OcppMessageHandler = {
  handleCall: function (vcp: VCP, call: OcppCall<any>): void {
    const handler = callHandlers[call.action];
    if (!handler) {
      throw new Error(`Call handler not implemented for ${call.action}`);
    }
    handler(vcp, call);
  },
  handleCallResult: function (
    vcp: VCP,
    call: OcppCall<any>,
    result: OcppCallResult<any>
  ): void {
    const handler = callResultHandlers[result.action];
    if (!handler) {
      throw new Error(
        `CallResult handler not implemented for ${result.action}`
      );
    }
    handler(vcp, call, result);
  },
  handleCallError: function (vcp: VCP, error: OcppCallError<any>): void {
    // NOOP
  },
};
