import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const CostUpdatedReqSchema = z.object({
  totalCost: z.number(),
  transactionId: z.string(),
});
type CostUpdatedReqType = typeof CostUpdatedReqSchema;

const CostUpdatedResSchema = z.object({});
type CostUpdatedResType = typeof CostUpdatedResSchema;

class CostUpdatedOcppMessage extends OcppMessage<
  CostUpdatedReqType,
  CostUpdatedResType
> {
  reqHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<CostUpdatedReqType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const costUpdatedOcppMessage = new CostUpdatedOcppMessage(
  "CostUpdated",
  CostUpdatedReqSchema,
  CostUpdatedResSchema,
);
