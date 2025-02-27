import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargingProfileSchema } from "./_common";

const ReportChargingProfilesReqSchema = z.object({
  requestId: z.number().int(),
  chargingLimitSource: z.enum(["EMS", "Other", "SO", "CSO"]),
  tbc: z.boolean().nullish(),
  evseId: z.number().int(),
  chargingProfile: z.array(ChargingProfileSchema),
});
type ReportChargingProfilesReqType = typeof ReportChargingProfilesReqSchema;

const ReportChargingProfilesResSchema = z.object({});
type ReportChargingProfilesResType = typeof ReportChargingProfilesResSchema;

class ReportChargingProfilesOcppOutgoing extends OcppOutgoing<
  ReportChargingProfilesReqType,
  ReportChargingProfilesResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<ReportChargingProfilesReqType>>,
    _result: OcppCallResult<z.infer<ReportChargingProfilesResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const reportChargingProfilesOcppOutgoing =
  new ReportChargingProfilesOcppOutgoing(
    "ReportChargingProfiles",
    ReportChargingProfilesReqSchema,
    ReportChargingProfilesResSchema,
  );
