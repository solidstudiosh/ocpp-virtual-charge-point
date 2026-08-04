import { z } from "zod";
import { logger } from "../../logger";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  ChargingProfileSchema,
  ConnectorIdSchema,
  IdTokenSchema,
} from "./_common";
import { startTransactionOcppMessage } from "./startTransaction";
import { statusNotificationOcppMessage } from "./statusNotification";

const RemoteStartTransactionReqSchema = z.object({
  connectorId: ConnectorIdSchema.nullish(),
  idTag: IdTokenSchema,
  chargingProfile: ChargingProfileSchema.nullish(),
});
type RemoteStartTransactionReqType = typeof RemoteStartTransactionReqSchema;

const RemoteStartTransactionResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type RemoteStartTransactionResType = typeof RemoteStartTransactionResSchema;

class RemoteStartTransactionOcppMessage extends OcppIncoming<
  RemoteStartTransactionReqType,
  RemoteStartTransactionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RemoteStartTransactionReqType>>,
  ): Promise<void> => {
    if (!call.payload.connectorId) {
      if (process.env.CONNECTORLESS_FLOW_CONNECTOR_ID) {
        call.payload.connectorId = Number(
          process.env.CONNECTORLESS_FLOW_CONNECTOR_ID,
        );
        logger.info(
          `RemoteStartTransaction has no connectorId - using the preconfigured CONNECTORLESS_FLOW_CONNECTOR_ID=${call.payload.connectorId}`,
        );
      } else {
        logger.warn(
          "Rejecting RemoteStartTransaction: no connectorId in the request. Set CONNECTORLESS_FLOW_CONNECTOR_ID to accept it on a fixed connector.",
        );
        vcp.respond(this.response(call, { status: "Rejected" }));
        return;
      }
    }
    if (
      !vcp.transactionManager.canStartNewTransaction(call.payload.connectorId)
    ) {
      logger.warn(
        `Rejecting RemoteStartTransaction: connector ${call.payload.connectorId} already has an ongoing transaction.`,
      );
      vcp.respond(this.response(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(this.response(call, { status: "Accepted" }));
    vcp.send(
      startTransactionOcppMessage.request({
        connectorId: call.payload.connectorId,
        idTag: call.payload.idTag,
        meterStart: 0,
        timestamp: new Date().toISOString(),
      }),
    );
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: call.payload.connectorId,
        errorCode: "NoError",
        status: "Charging",
      }),
    );
  };
}

export const remoteStartTransactionOcppMessage =
  new RemoteStartTransactionOcppMessage(
    "RemoteStartTransaction",
    RemoteStartTransactionReqSchema,
    RemoteStartTransactionResSchema,
  );
