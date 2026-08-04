import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

const date = new Date();
// "0" is a placeholder: the VCP substitutes the id of the ongoing transaction,
// so it does not have to be known here. Left as "0" if there is no transaction,
// or more than one - then the CSMS decides how to respond.
const transactionId = process.env.TRANSACTION_ID ?? "0";

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
      // Substituted from the TOKEN env var - see startTransaction.
      idToken: "__TOKEN__",
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
