import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const ExtendedTriggerMessageReqSchema = z.object({
  requestedMessage: z.enum([
    "BootNotification",
    "LogStatusNotification",
    "FirmwareStatusNotification",
    "Heartbeat",
    "MeterValues",
    "SignChargePointCertificate",
    "StatusNotification",
  ]),
  connectorId: z.number().int().nullish(),
});
type ExtendedTriggerMessageReqType = typeof ExtendedTriggerMessageReqSchema;

const ExtendedTriggerMessageResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotImplemented"]),
});
type ExtendedTriggerMessageResType = typeof ExtendedTriggerMessageResSchema;

class ExtendedTriggerMessageOcppMessage extends OcppIncoming<
  ExtendedTriggerMessageReqType,
  ExtendedTriggerMessageResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ExtendedTriggerMessageReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));

    if (call.payload.requestedMessage === "SignChargePointCertificate") {
      // Defer execution slightly to allow the Accepted response to flush first
      setTimeout(() => {
        vcp.triggerCertificateSign();
      }, 500);
    }
  };
}

export const extendedTriggerMessageOcppMessage =
  new ExtendedTriggerMessageOcppMessage(
    "ExtendedTriggerMessage",
    ExtendedTriggerMessageReqSchema,
    ExtendedTriggerMessageResSchema,
  );
