import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "DataTransfer",
  messageId: uuid.v4(),
  payload: {
    vendorId:"ATESS",
    messageId:"currentrecord",
    data:"id=939&connectorId=1&chargemode=3&plugtime=2024-06-11 12:09:37&unplugtime=2024-06-11 13:49:58&starttime=2024-06-11 12:09:38&endtime=2024-06-11 13:49:58&costenergy=5044&costmoney=146&transactionId=1984463994&workmode=0"
  },
});
