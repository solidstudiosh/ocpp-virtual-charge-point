import * as uuid from "uuid";
import { sendAdminCommand } from "../../admin";

sendAdminCommand({
    action: "SecurityEventNotification",
    messageId: uuid.v4(),
    payload: {
        timestamp: new Date(),
        type: "TamperDetectionActivated",
        techInfo: "(Open)The physical tamper detection sensor was triggered"
    },
});
