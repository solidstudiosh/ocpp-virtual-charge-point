import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

const POWER = Number.parseFloat(process.env.POWER ?? "1");
// Kept as a string so the value is sent exactly as configured - the schema
// expects a string and a float round-trip could change the digits.
const ENERGY = process.env.ENERGY ?? "43.123456789";
// 0 is a placeholder: the VCP substitutes the id of the ongoing transaction, so
// it does not have to be known here. Left as 0 if there is no transaction, or
// more than one - then the CSMS decides how to respond.
const transactionId = Number.parseInt(process.env.TRANSACTION_ID ?? "0");

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
            value: ENERGY,
            measurand: "Energy.Active.Import.Register",
            unit: "kWh",
          },
        ],
      },
    ],
  },
});
