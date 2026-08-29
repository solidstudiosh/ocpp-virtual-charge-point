import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { setProfile } from "../chargingProfileStore";
import { ChargingProfileSchema, ConnectorIdSchema } from "./_common";

const SetChargingProfileReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  csChargingProfiles: ChargingProfileSchema,
});
type SetChargingProfileReqType = typeof SetChargingProfileReqSchema;

const SetChargingProfileResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotSupported"]),
});
type SetChargingProfileResType = typeof SetChargingProfileResSchema;

class SetChargingProfileOcppMessage extends OcppIncoming<
  SetChargingProfileReqType,
  SetChargingProfileResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetChargingProfileReqType>>,
  ): Promise<void> => {
    setProfile(call.payload.connectorId, call.payload.csChargingProfiles);
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setChargingProfileOcppMessage = new SetChargingProfileOcppMessage(
  "SetChargingProfile",
  SetChargingProfileReqSchema,
  SetChargingProfileResSchema,
);
