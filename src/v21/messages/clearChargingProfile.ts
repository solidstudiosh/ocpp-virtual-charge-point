import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargingProfilePurposeSchema, StatusInfoTypeSchema } from "./_common";

const ClearChargingProfileReqSchema = z.object({
  chargingProfileId: z.number().int().nullish(),
  chargingProfileCriteria: z
    .object({
      evseId: z.number().int().nullish(),
      chargingProfilePurpose: ChargingProfilePurposeSchema.nullish(),
      stackLevel: z.number().int().nullish(),
    })
    .nullish(),
});
type ClearChargingProfileReqType = typeof ClearChargingProfileReqSchema;

const ClearChargingProfileResSchema = z.object({
  status: z.enum(["Accepted", "Unknown"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ClearChargingProfileResType = typeof ClearChargingProfileResSchema;

class ClearChargingProfileOcppIncoming extends OcppIncoming<
  ClearChargingProfileReqType,
  ClearChargingProfileResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ClearChargingProfileReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const clearChargingProfileOcppIncoming =
  new ClearChargingProfileOcppIncoming(
    "ClearChargingProfile",
    ClearChargingProfileReqSchema,
    ClearChargingProfileResSchema,
  );
