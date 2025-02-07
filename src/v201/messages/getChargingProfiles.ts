import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class GetChargingProfilesOcppMessage extends OcppMessage<
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

export const getChargingProfilesOcppMessage =
  new GetChargingProfilesOcppMessage(
    "GetChargingProfiles",
    GetChargingProfilesReqSchema,
    GetChargingProfilesResSchema,
  );
