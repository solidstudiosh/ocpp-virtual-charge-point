import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

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
            value: "0",
            context: "Sample.Periodic",
            format: "Raw",
            measurand: "Power.Active.Import",
            phase: "L1-N",
            location: "Outlet",
            unit: "Wh",
          },
          {
            value: "0",
            context: "Sample.Periodic",
            format: "Raw",
            measurand: "Power.Active.Import",
            phase: "L1-N",
            location: "Outlet",
            unit: "Percent",
          },
        ],
      },
    ],
  },
});
