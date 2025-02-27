import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { EVSETypeSchema, StatusInfoTypeSchema } from "./_common";

const TriggerMessageReqSchema = z.object({
  requestedMessage: z.enum([
    "BootNotification",
    "LogStatusNotification",
    "FirmwareStatusNotification",
    "Heartbeat",
    "MeterValues",
    "SignChargingStationCertificate",
    "SignV2GCertificate",
    "StatusNotification",
    "TransactionEvent",
    "SignCombinedCertificate",
    "PublishFirmwareStatusNotification",
  ]),
  evseId: EVSETypeSchema,
});
type TriggerMessageReqType = typeof TriggerMessageReqSchema;

const TriggerMessageResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotImplemented"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type TriggerMessageResType = typeof TriggerMessageResSchema;

class TriggerMessageOcppIncoming extends OcppIncoming<
  TriggerMessageReqType,
  TriggerMessageResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<TriggerMessageReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const triggerMessageOcppIncoming = new TriggerMessageOcppIncoming(
  "TriggerMessage",
  TriggerMessageReqSchema,
  TriggerMessageResSchema,
);
