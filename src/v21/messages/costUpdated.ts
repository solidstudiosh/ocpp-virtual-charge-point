import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const CostUpdatedReqSchema = z.object({
  totalCost: z.number(),
  transactionId: z.string().max(36),
});
type CostUpdatedReqType = typeof CostUpdatedReqSchema;

const CostUpdatedResSchema = z.object({});
type CostUpdatedResType = typeof CostUpdatedResSchema;

class CostUpdatedOcppIncoming extends OcppIncoming<
  CostUpdatedReqType,
  CostUpdatedResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<CostUpdatedReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, {}));
  };
}

export const costUpdatedOcppIncoming = new CostUpdatedOcppIncoming(
  "CostUpdated",
  CostUpdatedReqSchema,
  CostUpdatedResSchema,
);
