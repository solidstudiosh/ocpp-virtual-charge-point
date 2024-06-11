import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "DataTransfer",
  messageId: uuid.v4(),
  payload: {
    vendorId:"ATESS",
    messageId:"elockstate",
    data:"unlocked"
  },
});
