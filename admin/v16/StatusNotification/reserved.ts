import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "StatusNotification",
  messageId: uuid.v4(),
  payload: {
    connectorId: 1,
    errorCode: "NoError",
    status: "Reserved",
  },
});
