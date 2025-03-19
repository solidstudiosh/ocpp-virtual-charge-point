import { statusNotificationOcppMessage } from "../../../src/v16/messages/statusNotification";
import { sendAdminCommand } from "../../admin";

sendAdminCommand(
  statusNotificationOcppMessage.request({
    connectorId: 1,
    errorCode: "InternalError",
    status: "Faulted",
    timestamp: new Date().toISOString(),
  }),
);
