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

<<<<<<< HEAD
const callHandlers: { [key: string]: CallHandler } = {
  ClearCache: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  ChangeConfiguration: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, { status: "Accepted" }));
  },
  GetConfiguration: (vcp: VCP, call: OcppCall<GetConfigurationReq>) => {
    vcp.respond(
      callResult(call, {
        configurationKey: [
          {
            key: "SupportedFeatureProfiles",
            readonly: true,
            value:
              "Core,FirmwareManagement,LocalAuthListManagement,Reservation,SmartCharging,RemoteTrigger",
          },
          {
            key: "ChargeProfileMaxStackLevel",
            readonly: true,
            value: "99",
          },
          {
            key: "HeartbeatInterval",
            readonly: false,
            value: "300",
          },
          {
            key: "GetConfigurationMaxKeys",
            readonly: true,
            value: "99",
          },
        ],
      })
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
    if (!transactionManager.canStartNewTransaction(call.payload.connectorId)) {
      vcp.respond(callResult(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(callResult(call, { status: "Accepted" }));
    vcp.send(
      callFactory("StartTransaction", {
        connectorId: call.payload.connectorId,
        idTag: call.payload.idTag,
        meterStart: 0,
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
        meterStop: Math.floor(transactionManager.getMeterValue(transactionId)),
        timestamp: new Date(),
      })
    );
    vcp.send(
      callFactory("StatusNotification", {
        connectorId: transaction.connectorId,
        errorCode: "NoError",
        status: "Available",
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
    result: OcppCallResult<any>
  ) => {
    vcp.configureHeartbeat(result.payload.interval * 1000);
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
  Authorize: NOOP,
  DataTransfer: NOOP,
};
=======
const ocppMessages: { [key: string]: OcppMessage<z.ZodTypeAny, z.ZodTypeAny> } =
  {
    Authorize: authorizeOcppMessage,
    BootNotification: bootNotificationOcppMessage,
    CancelReservation: cancelReservationOcppMessage,
    ChangeAvailability: changeAvailabilityOcppMessage,
    ChangeConfiguration: changeConfigurationOcppMessage,
    ClearCache: clearCacheOcppMessage,
    ClearChargingProfile: clearChargingProfileOcppMessage,
    DataTransfer: dataTransferOcppMessage,
    DiagnosticsStatusNotification: diagnosticsStatusNotificationOcppMessage,
    FirmwareStatusNotification: firmwareStatusNotificationOcppMessage,
    GetCompositeSchedule: getCompositeScheduleOcppMessage,
    GetConfiguration: getConfigurationOcppMessage,
    GetDiagnostics: getDiagnosticsOcppMessage,
    GetLocalListVersion: getLocalListVersionOcppMessage,
    Heartbeat: heartbeatOcppMessage,
    MeterValues: meterValuesOcppMessage,
    RemoteStartTransaction: remoteStartTransactionOcppMessage,
    RemoteStopTransaction: remoteStopTransactionOcppMessage,
    ReserveNow: reserveNowOcppMessage,
    Reset: resetOcppMessage,
    SendLocalList: sendLocalListOcppMessage,
    SetChargingProfile: setChargingProfileOcppMessage,
    StartTransaction: startTransactionOcppMessage,
    StatusNotification: statusNotificationOcppMessage,
    StopTransaction: stopTransactionOcppMessage,
    TriggerMessage: triggerMessageOcppMessage,
    UnlockConnector: unlockConnectorOcppMessage,
    UpdateFirmware: updateFirmwareOcppMessage,
  };
>>>>>>> 756528d (feat: refactor ocpp1.6 to type-safe zod schemas)

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
