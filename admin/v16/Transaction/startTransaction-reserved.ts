import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "StartTransaction",
  messageId: uuid.v4(),
  payload: {
    connectorId: 1,
    idTag: "AABBCCDD",
    meterStart: 0,
    reservationId: 44,
    timestamp: new Date(),
  },
});
