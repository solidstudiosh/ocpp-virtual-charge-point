import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "StatusNotification",
  messageId: uuid.v4(),
  payload: {
    evseId: 1,
    connectorId: 1,
    connectorStatus: "Occupied",
    timestamp: new Date(),
  },
});
