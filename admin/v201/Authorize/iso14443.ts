import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "Authorize",
  messageId: uuid.v4(),
  payload: {
    idToken: {
      idToken: "0F9A312A",
      type: "ISO14443",
    },
  },
});
