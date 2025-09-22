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
      vcp.send(
        statusNotificationOcppMessage.request({
          connectorId: call.payload.connectorId,
          errorCode: "NoError",
          status: "Unavailable",
        }),
      );
    }
  };
}

export const changeAvailabilityOcppMessage = new ChangeAvailabilityOcppMessage(
  "ChangeAvailability",
  ChangeAvailabilityReqSchema,
  ChangeAvailabilityResSchema,
);
