import { z } from "zod";
import { logger } from "../../logger";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, IdTagSchema } from "./_common";
import { startTransactionOcppMessage } from "./startTransaction";
import { statusNotificationOcppMessage } from "./statusNotification";

// connectorId exists only in the 2010/10 WSDL (VERSION-DIFF D1); a 2010/08
// box always gets the request without it.
const RemoteStartTransactionReqSchema = z.object({
  idTag: IdTagSchema,
  connectorId: ConnectorIdSchema.nullish(),
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
    let connectorId = call.payload.connectorId;
    if (!connectorId) {
      if (!process.env.CONNECTORLESS_FLOW_CONNECTOR_ID) {
        logger.warn(
          "Rejecting RemoteStartTransaction: no connectorId in the request. Set CONNECTORLESS_FLOW_CONNECTOR_ID to accept it on a fixed connector.",
        );
        vcp.respond(this.response(call, { status: "Rejected" }));
        return;
      }
      connectorId = Number(process.env.CONNECTORLESS_FLOW_CONNECTOR_ID);
      logger.info(
        `RemoteStartTransaction has no connectorId - using the preconfigured CONNECTORLESS_FLOW_CONNECTOR_ID=${connectorId}`,
      );
    }
    if (!vcp.transactionManager.canStartNewTransaction(connectorId)) {
      logger.warn(
        `Rejecting RemoteStartTransaction: connector ${connectorId} already has an ongoing transaction.`,
      );
      vcp.respond(this.response(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(this.response(call, { status: "Accepted" }));
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId,
        errorCode: "NoError",
        status: "Occupied",
      }),
    );
    vcp.send(
      startTransactionOcppMessage.request({
        connectorId,
        idTag: call.payload.idTag,
        meterStart: 0,
        timestamp: new Date().toISOString(),
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
