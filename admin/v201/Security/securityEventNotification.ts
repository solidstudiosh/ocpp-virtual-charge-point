import { securityEventNotificationOcppOutgoing } from "../../../src/v201/messages/securityEventNotification";
import { sendAdminCommand } from "../../admin";

sendAdminCommand(
  securityEventNotificationOcppOutgoing.request({
    type: "InvalidCsmsCertificate",
    timestamp: new Date().toISOString(),
    techInfo: "Sent from VCP",
  }),
);
