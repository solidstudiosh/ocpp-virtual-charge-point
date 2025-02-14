import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const UsePriorityChargingReqSchema = z.object({
  transactionId: z.string().max(36),
  activate: z.boolean(),
});
type UsePriorityChargingReqType = typeof UsePriorityChargingReqSchema;

const UsePriorityChargingResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NoProfile"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type UsePriorityChargingResType = typeof UsePriorityChargingResSchema;

class UsePriorityChargingOcppMessage extends OcppMessage<
  UsePriorityChargingReqType,
  UsePriorityChargingResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<UsePriorityChargingReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const usePriorityChargingOcppMessage =
  new UsePriorityChargingOcppMessage(
    "UsePriorityCharging",
    UsePriorityChargingReqSchema,
    UsePriorityChargingResSchema,
  );
