import { logStatusNotificationOcppMessage } from "../../../src/v16/messages/logStatusNotification";
import { sendAdminCommand } from "../../admin";

sendAdminCommand(
  logStatusNotificationOcppMessage.request({
    status: "Uploaded",
  }),
);
