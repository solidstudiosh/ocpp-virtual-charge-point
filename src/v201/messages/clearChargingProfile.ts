import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class ClearChargingProfileOcppMessage extends OcppMessage<
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

export const clearChargingProfileOcppMessage =
  new ClearChargingProfileOcppMessage(
    "ClearChargingProfile",
    ClearChargingProfileReqSchema,
    ClearChargingProfileResSchema,
  );
