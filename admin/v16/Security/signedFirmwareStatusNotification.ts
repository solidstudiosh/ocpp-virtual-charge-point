import { sendAdminCommand } from "../../admin";
import { signedFirmwareStatusNotificationOcppMessage } from "../../../src/v16/messages/signedFirmwareStatusNotification";

sendAdminCommand(
  signedFirmwareStatusNotificationOcppMessage.request({
    status: "Installed",
  }),
);
