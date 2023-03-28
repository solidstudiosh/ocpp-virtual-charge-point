import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "Authorize",
  messageId: uuid.v4(),
  payload: {
    idToken: {
      idToken: "AABBCCDD",
      type: "ISO14443",
    },
  },
});
