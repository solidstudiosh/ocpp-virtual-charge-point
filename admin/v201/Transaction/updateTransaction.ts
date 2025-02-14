import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

const date = new Date();
const transactionId = process.env.TRANSACTION_ID ?? uuid.v4();

sendAdminCommand({
  action: "TransactionEvent",
  messageId: uuid.v4(),
  payload: {
    eventType: "Updated",
    timestamp: date,
    triggerReason: "MeterValuePeriodic",
    seqNo: 1,
    transactionInfo: {
      transactionId: transactionId,
    },
    evse: { id: 1 },
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
