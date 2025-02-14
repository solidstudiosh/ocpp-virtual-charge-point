import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
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

class ReportChargingProfilesOcppMessage extends OcppMessage<
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

export const reportChargingProfilesOcppMessage =
  new ReportChargingProfilesOcppMessage(
    "ReportChargingProfiles",
    ReportChargingProfilesReqSchema,
    ReportChargingProfilesResSchema,
  );
