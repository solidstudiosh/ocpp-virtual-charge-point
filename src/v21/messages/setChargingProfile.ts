import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargingProfileSchema, StatusInfoTypeSchema } from "./_common";

const SetChargingProfileReqSchema = z.object({
  evseId: z.number().int(),
  chargingProfile: ChargingProfileSchema,
});
type SetChargingProfileReqType = typeof SetChargingProfileReqSchema;

const SetChargingProfileResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SetChargingProfileResType = typeof SetChargingProfileResSchema;

class SetChargingProfileOcppIncoming extends OcppIncoming<
  SetChargingProfileReqType,
  SetChargingProfileResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetChargingProfileReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setChargingProfileOcppIncoming =
  new SetChargingProfileOcppIncoming(
    "SetChargingProfile",
    SetChargingProfileReqSchema,
    SetChargingProfileResSchema,
  );
