import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema, Tariff } from "./_common";

const SetDefaultTariffReqSchema = z.object({
  evseId: z.number().int().nonnegative(),
  tariff: Tariff,
});
type SetDefaultTariffReqType = typeof SetDefaultTariffReqSchema;

const SetDefaultTariffResSchema = z.object({
  status: z.enum([
    "Accepted",
    "Rejected",
    "TooManyElements",
    "ConditionNotSupported",
    "DuplicateTariffId",
  ]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SetDefaultTariffResType = typeof SetDefaultTariffResSchema;

class SetDefaultTariffOcppIncoming extends OcppIncoming<
  SetDefaultTariffReqType,
  SetDefaultTariffResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetDefaultTariffReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setDefaultTariffOcppIncoming = new SetDefaultTariffOcppIncoming(
  "SetDefaultTariff",
  SetDefaultTariffReqSchema,
  SetDefaultTariffResSchema,
);
