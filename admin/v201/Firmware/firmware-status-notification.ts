import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "FirmwareStatusNotification",
  messageId: uuid.v4(),
  payload: {
    status: "Installed",
  },
});
