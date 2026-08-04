import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

const date = new Date();
const transactionId = process.env.TRANSACTION_ID ?? uuid.v4();

sendAdminCommand({
  action: "TransactionEvent",
  messageId: uuid.v4(),
  payload: {
    eventType: "Started",
    timestamp: date,
    triggerReason: "Authorized",
    seqNo: 1,
    evse: { id: 1 },
    transactionInfo: {
      transactionId: transactionId,
    },
    idToken: {
      // "__TOKEN__" is a placeholder: the VCP substitutes the TOKEN env
      // var, so the token does not have to be edited per station. Spell
      // out a token here to override it.
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
          },
        ],
      },
    ],
  },
});
