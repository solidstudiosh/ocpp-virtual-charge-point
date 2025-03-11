import { z } from "zod";
import { generateOCMF, getOCMFPublicKey } from "../../ocmfGenerator";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
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

class RemoteStopTransactionOcppMessage extends OcppIncoming<
  RemoteStopTransactionReqType,
  RemoteStopTransactionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RemoteStopTransactionReqType>>,
  ): Promise<void> => {
    const transactionId = call.payload.transactionId;
    const transaction = vcp.transactionManager.transactions.get(transactionId);
    if (!transaction) {
      vcp.respond(this.response(call, { status: "Rejected" }));
      return;
    }
    vcp.respond(this.response(call, { status: "Accepted" }));

    const ocmf = generateOCMF({
      startTime: transaction.startedAt,
      startEnergy: 0,
      endTime: new Date(),
      endEnergy: vcp.transactionManager.getMeterValue(transactionId) / 1000,
      idTag: transaction.idTag,
    });

    vcp.send(
      stopTransactionOcppMessage.request({
        transactionId: transactionId,
        meterStop: Math.floor(
          vcp.transactionManager.getMeterValue(transactionId),
        ),
        timestamp: new Date().toISOString(),
        transactionData: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value: JSON.stringify({
                  signedMeterData: Buffer.from(ocmf).toString("base64"),
                  encodingMethod: "OCMF",
                  publicKey: getOCMFPublicKey().toString("base64"),
                }),
                format: "SignedData",
                context: "Transaction.End",
              },
            ],
          },
        ],
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
