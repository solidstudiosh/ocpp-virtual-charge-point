import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "Authorize",
  messageId: uuid.v4(),
  payload: {
    // "__TOKEN__" is a placeholder: the VCP substitutes the TOKEN env
    // var, so the token does not have to be edited per station. Spell
    // out a token here to override it.
    idTag: "__TOKEN__",
  },
});
