import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "StatusNotification",
  messageId: uuid.v4(),
  payload: {
    connectorId: 2,
    errorCode: "NoError",
    status: "Available",
  },
});
