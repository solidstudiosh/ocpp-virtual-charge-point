import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema } from "./_common";

const ClearChargingProfileReqSchema = z.object({
  id: z.number().int().nullish(),
  connectorId: ConnectorIdSchema.nullish(),
  chargingProfilePurpose: z
    .enum(["ChargePointMaxProfile", "TxDefaultProfile", "TxProfile"])
    .nullish(),
  stackLevel: z.number().int().nullish(),
});
type ClearChargingProfileReqType = typeof ClearChargingProfileReqSchema;

const ClearChargingProfileResSchema = z.object({
  status: z.enum(["Accepted", "Unknown"]),
});
type ClearChargingProfileResType = typeof ClearChargingProfileResSchema;

class ClearChargingProfileOcppMessage extends OcppIncoming<
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
