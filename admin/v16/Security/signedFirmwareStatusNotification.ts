import { signedFirmwareStatusNotificationOcppMessage } from "../../../src/v16/messages/signedFirmwareStatusNotification";
import { sendAdminCommand } from "../../admin";

sendAdminCommand(
  signedFirmwareStatusNotificationOcppMessage.request({
    status: "Installed",
  }),
);
