export interface GetConfigurationReq {
  key: string[];
}

type IdToken = string;

export interface RemoteStartTransactionReq {
  connectorId?: number;
  idTag: IdToken;
}

export interface RemoteStopTransactionReq {
  transactionId: number;
}

export type MessageTrigger =
  | "BootNotification"
  | "DiagnosticsStatusNotification"
  | "FirmwareStatusNotification"
  | "Heartbeat"
  | "MeterValues"
  | "StatusNotification";

export interface TriggerMessageReq {
  requestedMessage: MessageTrigger;
  connectorId?: number;
}
