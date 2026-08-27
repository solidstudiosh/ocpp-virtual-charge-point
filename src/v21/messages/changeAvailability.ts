import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import { countFromEnv, range } from "../../utils";
import type { VCP } from "../../vcp";
import { EVSETypeSchema, StatusInfoTypeSchema } from "./_common";
import { statusNotificationOcppOutgoing } from "./statusNotification";

const ChangeAvailabilityReqSchema = z.object({
  operationalStatus: z.enum(["Inoperative", "Operative"]),
  evse: EVSETypeSchema.nullish(),
});
type ChangeAvailabilityReqType = typeof ChangeAvailabilityReqSchema;

const ChangeAvailabilityResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Scheduled"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ChangeAvailabilityResType = typeof ChangeAvailabilityResSchema;

class ChangeAvailabilityOcppIncoming extends OcppIncoming<
  ChangeAvailabilityReqType,
  ChangeAvailabilityResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ChangeAvailabilityReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
    if (call.payload.operationalStatus === "Inoperative") {
      const evses = countFromEnv("EVSES");
      const connectors = countFromEnv("CONNECTORS");
      // No evse addresses the whole charging station, an evse without a
      // connectorId addresses every connector of that evse.
      const evseIds = call.payload.evse ? [call.payload.evse.id] : range(evses);
      const connectorIds = call.payload.evse?.connectorId
        ? [call.payload.evse.connectorId]
        : range(connectors);
      for (const evseId of evseIds) {
        for (const connectorId of connectorIds) {
          vcp.send(
            statusNotificationOcppOutgoing.request({
              timestamp: new Date().toISOString(),
              connectorStatus: "Unavailable",
              evseId,
              connectorId,
            }),
          );
        }
      }
    }
  };
}

export const changeAvailabilityOcppIncoming =
  new ChangeAvailabilityOcppIncoming(
    "ChangeAvailability",
    ChangeAvailabilityReqSchema,
    ChangeAvailabilityResSchema,
  );
