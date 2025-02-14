import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema, Tariff } from "./_common";

const ChangeTransactionTariffReqSchema = z.object({
  transactionId: z.string().max(36),
  tariff: Tariff,
});
type ChangeTransactionTariffReqType = typeof ChangeTransactionTariffReqSchema;

const ChangeTransactionTariffResSchema = z.object({
  status: z.enum([
    "Accepted",
    "Rejected",
    "TooManyElements",
    "ConditionNotSupported",
    "TxNotFound",
    "NoCurrencyChange",
  ]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type ChangeTransactionTariffResType = typeof ChangeTransactionTariffResSchema;

class ChangeTransactionTariffOcppMessage extends OcppMessage<
  ChangeTransactionTariffReqType,
  ChangeTransactionTariffResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ChangeTransactionTariffReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const changeTransactionTariffOcppMessage =
  new ChangeTransactionTariffOcppMessage(
    "ChangeTransactionTariff",
    ChangeTransactionTariffReqSchema,
    ChangeTransactionTariffResSchema,
  );
