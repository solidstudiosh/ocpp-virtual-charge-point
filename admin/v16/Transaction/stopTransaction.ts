import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "StopTransaction",
  messageId: uuid.v4(),
  payload: {
    // 0 is a placeholder: the VCP substitutes the id of the ongoing
    // transaction, so it does not have to be known here. Left as 0 if there is
    // no transaction, or more than one - then the CSMS decides how to respond.
    transactionId: 0,
    timestamp: new Date(),
    meterStop: Number.parseInt(process.env.METER_STOP ?? "2000"),
  },
});
