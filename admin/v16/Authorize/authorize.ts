import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "Authorize",
  messageId: uuid.v4(),
  payload: {
    idTag: "AABBCCDD",
  },
});
