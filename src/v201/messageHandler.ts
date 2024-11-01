import * as uuid from "uuid";
import {call as callFactory, callResult} from "../messageFactory";
import {OcppCall, OcppCallError, OcppCallResult} from "../ocppMessage";
import {
  CallHandler,
  CallResultHandler,
  OcppMessageHandler,
} from "../ocppMessageHandler";
import {delay} from "../utils";
import {VCP} from "../vcp";
import {transactionManager} from "./transactionManager";
import {RequestStartTransactionReq, TransactionEventReq} from "./types";

const callHandlers: { [key: string]: CallHandler } = {
  ChangeConfiguration: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, {status: "Accepted"}));
  },
  GetConfiguration: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, {configurationKey: []}));
  },
  GetBaseReport: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, {status: "Accepted"}));
    vcp.send(
      callFactory("NotifyReport", {
        requestId: call.payload.requestId,
        generatedAt: new Date(),
        seqNo: 0,
        tbc: false,
        reportData: [
          {
            component: {
              name: "OCPPCommCtrlr",
            },
            variable: {
              name: "HeartbeatInterval",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "60",
                mutability: "ReadWrite",
                persistent: true,
                constant: false,
              },
            ],
            variableCharacteristics: {
              unit: "s",
              dataType: "integer",
              supportsMonitoring: false,
            },
          },
          {
            component: {
              name: "AuthCtrlr",
            },
            variable: {
              name: "AuthorizeRemoteStart",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "false",
                mutability: "ReadWrite",
                persistent: true,
                constant: true,
              },
            ],
            variableCharacteristics: {
              dataType: "boolean",
              supportsMonitoring: false,
            },
          },
          {
            component: {
              name: "AuthCtrlr",
            },
            variable: {
              name: "LocalPreAuthorize",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "false",
                mutability: "ReadWrite",
                persistent: true,
                constant: true,
              },
            ],
            variableCharacteristics: {
              dataType: "boolean",
              supportsMonitoring: false,
            },
          },
          {
            component: {
              name: "TxCtrlr",
            },
            variable: {
              name: "EVConnectionTimeOut",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "10",
                mutability: "ReadWrite",
                persistent: true,
                constant: false,
              },
            ],
            variableCharacteristics: {
              dataType: "integer",
              supportsMonitoring: false,
            },
          },
        ],
      })
    );
  },
  SetVariables: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(
      callResult(call, {
        setVariableResult: [
          {
            attributeStatus: "Accepted",
            component: {
              name: "SecurityCtrlr",
            },
            variable: {
              name: "BasicAuthPassword",
            },
          },
        ],
      })
    );

    // start meter values timer
    const transactionId = uuid.v4();
    transactionManager.startTransaction(
        vcp,
        transactionId,
        call.payload.evseId ?? 1,
        call.payload.connectorId ?? 1,
        call.payload.setVariableData[0].attributeValue ?? 1,
    );
  },
  GetVariables: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(
      callResult(call, {
        getVariableResult: [],
      })
    );
  },
  Reset: async (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, {status: "Accepted"}));
    await delay(3_000);
    process.exit(1);
  },
  UnlockConnector: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, {status: "Unlocked"}));
  },
  TriggerMessage: (vcp: VCP, call: OcppCall<any>) => {
    if (call.payload.requestedMessage === "StatusNotification") {
      vcp.respond(callResult(call, {status: "Accepted"}));
      vcp.send(
        callFactory("StatusNotification", {
          evseId: 1,
          connectorId: 1,
          connectorStatus: "Occupied",
          timestamp: new Date(),
        })
      );
    } else {
      vcp.respond(callResult(call, {status: "NotImplemented"}));
    }
  },
  RequestStartTransaction: (
    vcp: VCP,
    call: OcppCall<RequestStartTransactionReq>
  ) => {
    const transactionId = uuid.v4();
    transactionManager.startTransaction(
      vcp,
      transactionId,
      call.payload.evseId ?? 1,
      call.payload.connectorId ?? 1,
        1
    );
    vcp.respond(
      callResult(call, {
        status: "Accepted",
      })
    );
    vcp.send(
      callFactory("StatusNotification", {
        evseId: call.payload.evseId ?? 1,
        connectorId: call.payload.connectorId ?? 1,
        connectorStatus: "Occupied",
        timestamp: new Date(),
      })
    );
    vcp.send(
      callFactory<TransactionEventReq>("TransactionEvent", {
        eventType: "Started",
        timestamp: new Date(),
        seqNo: 0,
        triggerReason: "Authorized",
        transactionInfo: {
          transactionId: transactionId,
        },
        idToken: call.payload.idToken,
        evse: {
          id: call.payload.evseId ?? 1,
          connectorId: call.payload.connectorId ?? 1,
        },
        meterValue: [
          {
            timestamp: new Date(),
            sampledValue: [
              {
                value: 0,
                measurand: "Energy.Active.Import.Register",
                unitOfMeasure: {
                  unit: "kWh",
                },
              },
            ],
          },
        ],
      })
    );
  },
  RequestStopTransaction: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(
      callResult(call, {
        status: "Accepted",
      })
    );
    vcp.send(
      callFactory<TransactionEventReq>("TransactionEvent", {
        eventType: "Ended",
        timestamp: new Date(),
        seqNo: 0,
        triggerReason: "RemoteStop",
        transactionInfo: {
          transactionId: call.payload.transactionId,
        },
        evse: {
          id: 1,
          connectorId: 1,
        },
        meterValue: [
          {
            timestamp: new Date(),
            sampledValue: [
              {
                value: 0,
                measurand: "Energy.Active.Import.Register",
                unitOfMeasure: {
                  unit: "kWh",
                },
              },
            ],
          },
        ],
      })
    );
    vcp.send(
      callFactory("StatusNotification", {
        evseId: 1,
        connectorId: 1,
        connectorStatus: "Available",
        timestamp: new Date(),
      })
    );
    transactionManager.stopTransaction(call.payload.transactionId);
  },
  DataTransfer: (vcp: VCP, call: OcppCall<any>) => {
    vcp.respond(callResult(call, {status: "Accepted"}));
  },
};

const callResultHandlers: { [key: string]: CallResultHandler } = {
  BootNotification: (
    vcp: VCP,
    call: OcppCall<any>,
    result: OcppCallResult<any>
  ) => {
    vcp.configureHeartbeat(result.payload.interval * 1000);
  },
};

export const messageHandlerV201: OcppMessageHandler = {
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
      return;
    }
    handler(vcp, call, result);
  },
  handleCallError: function (vcp: VCP, error: OcppCallError<any>): void {
    // throw new Error("Function not implemented.");
  },
};
