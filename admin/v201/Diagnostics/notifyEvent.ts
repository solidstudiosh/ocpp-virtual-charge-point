import { notifyEventOcppOutgoing } from "../../../src/v201/messages/notifyEvent";
import { sendAdminCommand } from "../../admin";

sendAdminCommand(
  notifyEventOcppOutgoing.request({
    generatedAt: new Date().toISOString(),
    seqNo: 0,
    eventData: [
      {
        eventId: 1,
        timestamp: new Date().toISOString(),
        trigger: "Alerting",
        actualValue: "Faulted",
        techCode: "E01",
        techInfo: "Sent from VCP",
        eventNotificationType: "HardWiredNotification",
        component: {
          name: "Connector",
          evse: {
            id: 1,
            connectorId: 1,
          },
        },
        variable: {
          name: "AvailabilityState",
        },
      },
    ],
  }),
);
