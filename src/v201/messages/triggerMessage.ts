import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { EVSETypeSchema, StatusInfoTypeSchema } from "./_common";
import {
  bootNotificationOcppOutgoing,
  VCP_CHARGING_STATION,
} from "./bootNotification";
import { heartbeatOcppOutgoing } from "./heartbeat";
import { operativeStatusOf, sendConnectorStatuses } from "./statusNotification";

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

type TriggerRequest = z.infer<TriggerMessageReqType>;

const triggeredMessages: Partial<
  Record<
    TriggerRequest["requestedMessage"],
    (vcp: VCP, req: TriggerRequest) => void
  >
> = {
  BootNotification: (vcp) =>
    vcp.send(
      bootNotificationOcppOutgoing.request({
        reason: "Triggered",
        chargingStation: VCP_CHARGING_STATION,
      }),
    ),
  Heartbeat: (vcp) => vcp.send(heartbeatOcppOutgoing.request({})),
  StatusNotification: (vcp, { evse }) =>
    sendConnectorStatuses(vcp, evse, (evseId, connectorId) =>
      operativeStatusOf(vcp, evseId, connectorId),
    ),
};

class TriggerMessageOcppIncoming extends OcppIncoming<
  TriggerMessageReqType,
  TriggerMessageResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<TriggerRequest>,
  ): Promise<void> => {
    const send = triggeredMessages[call.payload.requestedMessage];
    if (!send) {
      vcp.respond(this.response(call, { status: "NotImplemented" }));
      return;
    }
    // The station answers the TriggerMessage before it sends what was asked for.
    vcp.respond(this.response(call, { status: "Accepted" }));
    send(vcp, call.payload);
  };
}

export const triggerMessageOcppIncoming = new TriggerMessageOcppIncoming(
  "TriggerMessage",
  TriggerMessageReqSchema,
  TriggerMessageResSchema,
);
