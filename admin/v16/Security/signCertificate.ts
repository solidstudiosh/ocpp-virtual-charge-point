import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
  action: "SignCertificate",
  messageId: uuid.v4(),
  payload: {
    csr: "-----BEGIN CERTIFICATE REQUEST-----",
  },
});
