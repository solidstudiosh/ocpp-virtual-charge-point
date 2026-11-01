import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { EVSETypeSchema, StatusInfoTypeSchema } from "./_common";
import { isInoperative } from "./changeAvailability";
import { statusNotificationOcppOutgoing } from "./statusNotification";

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
  evse: EVSETypeSchema.nullish(),
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
    const { requestedMessage, evse } = call.payload;
    if (requestedMessage !== "StatusNotification") {
      vcp.respond(this.response(call, { status: "Accepted" }));
      return;
    }
    // OCPP 2.0.1 F06: a StatusNotification is triggered for one connector only.
    if (!evse?.connectorId) {
      vcp.respond(this.response(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(this.response(call, { status: "Accepted" }));
    vcp.send(
      statusNotificationOcppOutgoing.request({
        evseId: evse.id,
        connectorId: evse.connectorId,
        connectorStatus: connectorStatusOf(vcp, evse.id, evse.connectorId),
        timestamp: new Date().toISOString(),
      }),
    );
  };
}

function connectorStatusOf(
  vcp: VCP,
  evseId: number,
  connectorId: number,
): "Available" | "Occupied" | "Unavailable" {
  if (isInoperative(evseId, connectorId)) return "Unavailable";
  const charging = Array.from(
    vcp.transactionManager.transactions.values(),
  ).some(
    (transaction) =>
      transaction.evseId === evseId && transaction.connectorId === connectorId,
  );
  return charging ? "Occupied" : "Available";
}

export const triggerMessageOcppIncoming = new TriggerMessageOcppIncoming(
  "TriggerMessage",
  TriggerMessageReqSchema,
  TriggerMessageResSchema,
);
