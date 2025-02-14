import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { transactionManager } from "../transactionManager";
import { statusNotificationOcppMessage } from "./statusNotification";
import { stopTransactionOcppMessage } from "./stopTransaction";

const RemoteStopTransactionReqSchema = z.object({
  transactionId: z.number().int(),
});
type RemoteStopTransactionReqType = typeof RemoteStopTransactionReqSchema;

const RemoteStopTransactionResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type RemoteStopTransactionResType = typeof RemoteStopTransactionResSchema;

class RemoteStopTransactionOcppMessage extends OcppMessage<
  RemoteStopTransactionReqType,
  RemoteStopTransactionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RemoteStopTransactionReqType>>,
  ): Promise<void> => {
    const transactionId = call.payload.transactionId;
    const transaction = transactionManager.transactions.get(
      transactionId.toString(),
    );
    if (!transaction) {
      vcp.respond(this.response(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(this.response(call, { status: "Accepted" }));
    vcp.send(
      stopTransactionOcppMessage.request({
        transactionId: transactionId,
        meterStop: Math.floor(transactionManager.getMeterValue(transactionId)),
        timestamp: new Date().toISOString(),
      }),
    );
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: transaction.connectorId,
        errorCode: "NoError",
        status: "Available",
      }),
    );
  };
}

export const remoteStopTransactionOcppMessage =
  new RemoteStopTransactionOcppMessage(
    "RemoteStopTransaction",
    RemoteStopTransactionReqSchema,
    RemoteStopTransactionResSchema,
  );
