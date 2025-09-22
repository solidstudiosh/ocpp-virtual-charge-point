import { securityEventNotificationOcppMessage } from "../../../src/v16/messages/securityEventNotification";
import { sendAdminCommand } from "../../admin";

sendAdminCommand(
  securityEventNotificationOcppMessage.request({
    timestamp: new Date().toISOString(),
    type: "InalidCentralSystemCertificate",
  }),
);
