import { z } from "zod";
import { generateOCMF, getOCMFPublicKey } from "../../ocmfGenerator";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";
import { statusNotificationOcppOutgoing } from "./statusNotification";
import { transactionEventOcppOutgoing } from "./transactionEvent";

const RequestStopTransactionReqSchema = z.object({
  transactionId: z.string(),
});
type RequestStopTransactionReqType = typeof RequestStopTransactionReqSchema;

const RequestStopTransactionResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type RequestStopTransactionResType = typeof RequestStopTransactionResSchema;

class RequestStopTransactionOcppIncoming extends OcppIncoming<
  RequestStopTransactionReqType,
  RequestStopTransactionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RequestStopTransactionReqType>>,
  ): Promise<void> => {
    const { transactionId } = call.payload;
    const transaction = vcp.transactionManager.transactions.get(transactionId);
    if (!transaction) {
      vcp.respond(
        this.response(call, {
          status: "Rejected",
        }),
      );
      return;
    }

    vcp.respond(
      this.response(call, {
        status: "Accepted",
      }),
    );

    const ocmf = generateOCMF({
      startTime: transaction.startedAt,
      startEnergy: 0,
      endTime: new Date(),
      endEnergy: vcp.transactionManager.getMeterValue(transactionId) / 1000,
      idTag: transaction.idTag,
    });

    vcp.send(
      transactionEventOcppOutgoing.request({
        eventType: "Ended",
        timestamp: new Date().toISOString(),
        seqNo: 0,
        triggerReason: "RemoteStop",
        transactionInfo: {
          transactionId: transactionId,
        },
        evse: {
          id: 1,
          connectorId: 1,
        },
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value:
                  vcp.transactionManager.getMeterValue(transactionId) / 1000,
                signedMeterValue: {
                  signedMeterData: Buffer.from(ocmf).toString("base64"),
                  signingMethod: "", // Already included in the signedMeterData
                  encodingMethod: "OCMF",
                  publicKey: getOCMFPublicKey().toString("base64"),
                },
                context: "Transaction.End",
              },
            ],
          },
        ],
      }),
    );
    vcp.send(
      statusNotificationOcppOutgoing.request({
        evseId: 1,
        connectorId: 1,
        connectorStatus: "Available",
        timestamp: new Date().toISOString(),
      }),
    );
    vcp.transactionManager.stopTransaction(transactionId);
  };
}

export const requestStopTransactionOcppIncoming =
  new RequestStopTransactionOcppIncoming(
    "RequestStopTransaction",
    RequestStopTransactionReqSchema,
    RequestStopTransactionResSchema,
  );
