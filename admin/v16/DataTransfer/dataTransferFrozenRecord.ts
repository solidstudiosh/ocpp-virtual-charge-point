import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "DataTransfer",
  messageId: uuid.v4(),
  payload: {
    vendorId: "ATESS",
    messageId:"frozenrecord",
    data:
        {
          id:27,
          connectorId: 1,
          chargemode: 3,
          plugtime: "2024-03-09 15:20:54",
          unplugtime: "2024-03-10 04:33:18",
          starttime: "2024-03-10 00:29:38",
          endtime: "2024-03-10 04:33:18",
          costenergy: 28173,
          costmoney: 833,
          transactionId: 208952803
        }
  },
});




