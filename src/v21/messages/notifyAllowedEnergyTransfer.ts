import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { EnergyTransferMode, StatusInfoTypeSchema } from "./_common";

const NotifyAllowedEnergyTransferReqSchema = z.object({
  transactionId: z.string().max(36),
  allowedEnergyTransfer: z.array(EnergyTransferMode).nonempty(),
});
type NotifyAllowedEnergyTransferReqType =
  typeof NotifyAllowedEnergyTransferReqSchema;

const NotifyAllowedEnergyTransferResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type NotifyAllowedEnergyTransferResType =
  typeof NotifyAllowedEnergyTransferResSchema;

class NotifyAllowedEnergyTransferOcppIncoming extends OcppIncoming<
  NotifyAllowedEnergyTransferReqType,
  NotifyAllowedEnergyTransferResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<NotifyAllowedEnergyTransferReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const notifyAllowedEnergyTransferOcppIncoming =
  new NotifyAllowedEnergyTransferOcppIncoming(
    "NotifyAllowedEnergyTransfer",
    NotifyAllowedEnergyTransferReqSchema,
    NotifyAllowedEnergyTransferResSchema,
  );
