import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const GetChargingProfilesReqSchema = z.object({
  requestId: z.number().int(),
  evseId: z.number().int().nullish(),
  chargingProfile: z.object({
    chargingProfilePurpose: z
      .enum([
        "ChargingStationExternalConstraints",
        "ChargingStationMaxProfile",
        "TxDefaultProfile",
        "TxProfile",
        "PriorityCharging",
        "LocalGeneration",
      ])
      .nullish(),
    stackLevel: z.number().int().nonnegative().nullish(),
    chargingProfileId: z.array(z.number().int()).nullish(),
    chargingLimitSource: z
      .array(z.enum(["EMS", "Other", "SO", "CSO"]))
      .max(4)
      .nullish(),
  }),
});
type GetChargingProfilesReqType = typeof GetChargingProfilesReqSchema;

const GetChargingProfilesResSchema = z.object({
  status: z.enum(["Accepted", "NoProfiles"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetChargingProfilesResType = typeof GetChargingProfilesResSchema;

class GetChargingProfilesOcppIncoming extends OcppIncoming<
  GetChargingProfilesReqType,
  GetChargingProfilesResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetChargingProfilesReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const getChargingProfilesOcppIncoming =
  new GetChargingProfilesOcppIncoming(
    "GetChargingProfiles",
    GetChargingProfilesReqSchema,
    GetChargingProfilesResSchema,
  );
