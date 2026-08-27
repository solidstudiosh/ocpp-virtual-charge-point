import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
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

const range = (count: number): number[] =>
  Array.from({ length: Number.isNaN(count) ? 1 : count }, (_, i) => i + 1);

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
      const evses = Number.parseInt(process.env.EVSES ?? "1");
      const connectors = Number.parseInt(process.env.CONNECTORS ?? "1");
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
