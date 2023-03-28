import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "TransactionEvent",
  messageId: uuid.v4(),
  payload: {
    eventType: "Started",
    timestamp: new Date(),
    triggerReason: "CablePluggedIn",
    seqNo: 1,
    evse: {
      id: 1,
      connectorId: 1,
    },
    transactionInfo: {
      transactionId: uuid.v4(),
    },
    meterValue: [],
  },
});
