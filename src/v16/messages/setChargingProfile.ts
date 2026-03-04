import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
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
    const profile = call.payload.csChargingProfiles;

    // Find highest limit in the schedule periods (simplified)
    let maxLimit = 0;
    for (const period of profile.chargingSchedule.chargingSchedulePeriod) {
      maxLimit = Math.max(maxLimit, period.limit);
    }

    // Convert A to W if needed (assume 230V single phase for simplification)
    let limitW = maxLimit;
    if (profile.chargingSchedule.chargingRateUnit === "A") {
      limitW = maxLimit * 230;
    }

    // Pass the limit down to the transaction manager
    vcp.transactionManager.setSmartChargingLimit(call.payload.connectorId, limitW);

    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setChargingProfileOcppMessage = new SetChargingProfileOcppMessage(
  "SetChargingProfile",
  SetChargingProfileReqSchema,
  SetChargingProfileResSchema,
);
