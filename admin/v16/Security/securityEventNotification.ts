import { sendAdminCommand } from "../../admin";
import { securityEventNotificationOcppMessage } from "../../../src/v16/messages/securityEventNotification";

sendAdminCommand(
  securityEventNotificationOcppMessage.request({
    timestamp: new Date().toISOString(),
    type: "InalidCentralSystemCertificate",
  }),
);
