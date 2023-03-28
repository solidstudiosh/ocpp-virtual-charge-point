interface IdToken {
  idToken: string;
  type: string;
  additionalInfo?: any[];
}

export interface RequestStartTransactionReq {
  evseId?: number;
  remoteStartId: number;
  connectorId?: number;
  idToken: IdToken;
}

type TransactionEventEnum = "Ended" | "Started" | "Updated";

export interface TransactionEventReq {
  eventType: TransactionEventEnum;
}
