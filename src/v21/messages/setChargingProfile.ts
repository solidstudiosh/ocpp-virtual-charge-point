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

import { logger } from "../../logger";

class SetChargingProfileOcppIncoming extends OcppIncoming<
  SetChargingProfileReqType,
  SetChargingProfileResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetChargingProfileReqType>>,
  ): Promise<void> => {
    try {
      const profile = call.payload.chargingProfile;
      const periods = profile.chargingSchedule?.[0]?.chargingSchedulePeriod;

      if (periods && periods.length > 0) {
        // Take the first limit for simplistic simulator
        const limit = periods[0].limit;
        vcp.transactionManager.setSmartChargingLimit(call.payload.evseId, limit);
        logger.info(`[2.1] Applied Smart Charging Limit to EVSE ${call.payload.evseId}: ${limit} W`);
      }

      vcp.respond(this.response(call, { status: "Accepted" }));
    } catch (error) {
      vcp.respond(this.response(call, { status: "Rejected" }));
    }
  };
}

export const setChargingProfileOcppIncoming =
  new SetChargingProfileOcppIncoming(
    "SetChargingProfile",
    SetChargingProfileReqSchema,
    SetChargingProfileResSchema,
  );
