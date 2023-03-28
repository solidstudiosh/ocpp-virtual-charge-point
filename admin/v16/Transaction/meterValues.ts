import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

const POWER = parseFloat(process.env["POWER"] ?? "5");
const transactionId = parseInt(process.env["TRANSACTION_ID"] ?? "1555122493");

sendAdminCommand({
  action: "MeterValues",
  messageId: uuid.v4(),
  payload: {
    connectorId: 1,
    transactionId: transactionId,
    meterValue: [
      {
        timestamp: new Date(),
        sampledValue: [
          {
            value: "5",
            measurand: "Power.Active.Import",
            unit: "kW",
          },
          {
            value: "43.123456789",
            measurand: "Energy.Active.Import.Register",
            unit: 'kWh'
          },
        ],
      },
    ],
  },
});
