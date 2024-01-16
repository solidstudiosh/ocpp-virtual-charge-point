import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";


sendAdminCommand({
  action: "StartTransaction",
  messageId: uuid.v4(),
  payload: {
    connectorId: 1,
    idTag: 'AABBCCDD',
    meterStart: parseInt(process.env["INITIAL_METER_READINGS"] ?? '0'),
    timestamp: new Date(),
  }
});
