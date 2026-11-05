import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { EVSETypeSchema, StatusInfoTypeSchema } from "./_common";
import { operativeStatusOf, sendConnectorStatuses } from "./statusNotification";

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
    const inoperative = call.payload.operationalStatus === "Inoperative";
    sendConnectorStatuses(vcp, call.payload.evse, (evseId, connectorId) =>
      inoperative ? "Unavailable" : operativeStatusOf(vcp, evseId, connectorId),
    );
  };
}

export const changeAvailabilityOcppIncoming =
  new ChangeAvailabilityOcppIncoming(
    "ChangeAvailability",
    ChangeAvailabilityReqSchema,
    ChangeAvailabilityResSchema,
  );
