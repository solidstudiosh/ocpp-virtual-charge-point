import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

const POWER = Number.parseFloat(process.env.POWER ?? "1");
const transactionId = Number.parseInt(process.env.TRANSACTION_ID ?? "1");

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
            value: POWER,
            measurand: "Power.Active.Import",
            unit: "kW",
          },
          {
            value: "43.123456789",
            measurand: "Energy.Active.Import.Register",
            unit: "kWh",
          },
        ],
      },
    ],
  },
});
