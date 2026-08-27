import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema } from "./_common";
import { statusNotificationOcppMessage } from "./statusNotification";

const ChangeAvailabilityReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  type: z.enum(["Inoperative", "Operative"]),
});
type ChangeAvailabilityReqType = typeof ChangeAvailabilityReqSchema;

const ChangeAvailabilityResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Scheduled"]),
});
type ChangeAvailabilityResType = typeof ChangeAvailabilityResSchema;

class ChangeAvailabilityOcppMessage extends OcppIncoming<
  ChangeAvailabilityReqType,
  ChangeAvailabilityResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ChangeAvailabilityReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
    if (call.payload.type === "Inoperative") {
      const connectorIds = [];
      if (call.payload.connectorId !== 0) {
        connectorIds.push(call.payload.connectorId);
      } else if (process.env.CONNECTORS) {
        const connectors = Number.parseInt(process.env.CONNECTORS);
        for (let connectorId = 1; connectorId <= connectors; connectorId++) {
          connectorIds.push(connectorId);
        }
      } else {
        connectorIds.push(1);
      }
      for (let connectorId of connectorIds) {
        vcp.send(
          statusNotificationOcppMessage.request({
            connectorId,
            errorCode: "NoError",
            status: "Unavailable",
          }),
        );
      }
    }
  };
}

export const changeAvailabilityOcppMessage = new ChangeAvailabilityOcppMessage(
  "ChangeAvailability",
  ChangeAvailabilityReqSchema,
  ChangeAvailabilityResSchema,
);
