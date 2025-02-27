import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema } from "./_common";

const TriggerMessageReqSchema = z.object({
  requestedMessage: z.enum([
    "BootNotification",
    "DiagnosticsStatusNotification",
    "FirmwareStatusNotification",
    "Heartbeat",
    "MeterValues",
    "StatusNotification",
  ]),
  connectorId: ConnectorIdSchema.nullish(),
});
type TriggerMessageReqType = typeof TriggerMessageReqSchema;

const TriggerMessageResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotImplemented"]),
});
type TriggerMessageResType = typeof TriggerMessageResSchema;

class TriggerMessageOcppMessage extends OcppIncoming<
  TriggerMessageReqType,
  TriggerMessageResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<TriggerMessageReqType>>,
  ): Promise<void> => {
    if (call.payload.requestedMessage === "StatusNotification") {
      vcp.respond(this.response(call, { status: "Accepted" }));
    } else {
      vcp.respond(this.response(call, { status: "NotImplemented" }));
    }
  };
}

export const triggerMessageOcppMessage = new TriggerMessageOcppMessage(
  "TriggerMessage",
  TriggerMessageReqSchema,
  TriggerMessageResSchema,
);
