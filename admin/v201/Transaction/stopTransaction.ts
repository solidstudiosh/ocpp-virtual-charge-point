import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

const date = new Date();
const transactionId = process.env.TRANSACTION_ID ?? uuid.v4();

sendAdminCommand({
  action: "TransactionEvent",
  messageId: uuid.v4(),
  payload: {
    eventType: "Ended",
    timestamp: date,
    triggerReason: "RemoteStop",
    seqNo: 1,
    transactionInfo: {
      transactionId: transactionId,
    },
    evse: { id: 1 },
    idToken: {
      idToken: "AABBCCDD",
      type: "ISO14443",
    },
    meterValue: [
      {
        timestamp: date,
        sampledValue: [
          {
            value: 0,
            measurand: "Energy.Active.Import.Register",
            context: "Transaction.End",
          },
        ],
      },
    ],
  },
});
