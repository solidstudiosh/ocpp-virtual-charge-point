import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import { countFromEnv, range } from "../../utils";
import type { VCP } from "../../vcp";
import { type EVSETypeSchema, StatusInfoTypeSchema } from "./_common";

const StatusNotificationReqSchema = z.object({
  timestamp: z.string().datetime(),
  connectorStatus: z.enum([
    "Available",
    "Occupied",
    "Reserved",
    "Unavailable",
    "Faulted",
  ]),
  evseId: z.number().int(),
  connectorId: z.number().int(),
});
type StatusNotificationReqType = typeof StatusNotificationReqSchema;

const StatusNotificationResSchema = z.object({});
type StatusNotificationResType = typeof StatusNotificationResSchema;

class StatusNotificationOcppOutgoing extends OcppOutgoing<
  StatusNotificationReqType,
  StatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<StatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<StatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const statusNotificationOcppOutgoing =
  new StatusNotificationOcppOutgoing(
    "StatusNotification",
    StatusNotificationReqSchema,
    StatusNotificationResSchema,
  );

type ConnectorStatus = z.infer<
  typeof StatusNotificationReqSchema
>["connectorStatus"];

/**
 * Sends the status of every connector a CSMS request addresses: no evse means
 * the whole charging station, an evse without a connectorId every connector of
 * that evse.
 */
export function sendConnectorStatuses(
  vcp: VCP,
  evse: z.infer<typeof EVSETypeSchema> | null | undefined,
  statusOf: (evseId: number, connectorId: number) => ConnectorStatus,
) {
  const evseIds = evse ? [evse.id] : range(countFromEnv("EVSES"));
  const connectorIds = evse?.connectorId
    ? [evse.connectorId]
    : range(countFromEnv("CONNECTORS"));
  for (const evseId of evseIds) {
    for (const connectorId of connectorIds) {
      vcp.send(
        statusNotificationOcppOutgoing.request({
          timestamp: new Date().toISOString(),
          connectorStatus: statusOf(evseId, connectorId),
          evseId,
          connectorId,
        }),
      );
    }
  }
}

/** Occupied while the connector has a transaction, Available otherwise. */
export function operativeStatusOf(
  vcp: VCP,
  evseId: number,
  connectorId: number,
): ConnectorStatus {
  const charging = Array.from(
    vcp.transactionManager.transactions.values(),
  ).some(
    (transaction) =>
      transaction.evseId === evseId && transaction.connectorId === connectorId,
  );
  return charging ? "Occupied" : "Available";
}
