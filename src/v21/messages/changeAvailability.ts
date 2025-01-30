import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { EVSETypeSchema, StatusInfoTypeSchema } from "./_common";
import { statusNotificationOcppMessage } from "./statusNotification";

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

class ChangeAvailabilityOcppMessage extends OcppMessage<
  ChangeAvailabilityReqType,
  ChangeAvailabilityResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ChangeAvailabilityReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
    if (call.payload.operationalStatus === "Inoperative") {
      vcp.send(
        statusNotificationOcppMessage.request({
          timestamp: new Date().toISOString(),
          connectorStatus: "Unavailable",
          evseId: call.payload.evse?.id ?? 1,
          connectorId: call.payload.evse?.connectorId ?? 1,
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
