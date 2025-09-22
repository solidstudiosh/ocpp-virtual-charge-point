import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

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
