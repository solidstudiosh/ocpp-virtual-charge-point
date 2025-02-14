import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { transactionManager } from "../transactionManager";
import { StatusInfoTypeSchema } from "./_common";
import { statusNotificationOcppMessage } from "./statusNotification";
import { transactionEventOcppMessage } from "./transactionEvent";

const RequestStopTransactionReqSchema = z.object({
  transactionId: z.string(),
});
type RequestStopTransactionReqType = typeof RequestStopTransactionReqSchema;

const RequestStopTransactionResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type RequestStopTransactionResType = typeof RequestStopTransactionResSchema;

class RequestStopTransactionOcppMessage extends OcppMessage<
  RequestStopTransactionReqType,
  RequestStopTransactionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RequestStopTransactionReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        status: "Accepted",
      }),
    );
    vcp.send(
      transactionEventOcppMessage.request({
        eventType: "Ended",
        timestamp: new Date().toISOString(),
        seqNo: 0,
        triggerReason: "RemoteStop",
        transactionInfo: {
          transactionId: call.payload.transactionId,
        },
        evse: {
          id: 1,
          connectorId: 1,
        },
      }),
    );
    vcp.send(
      statusNotificationOcppMessage.request({
        evseId: 1,
        connectorId: 1,
        connectorStatus: "Available",
        timestamp: new Date().toISOString(),
      }),
    );
    transactionManager.stopTransaction(call.payload.transactionId);
  };
}

export const requestStopTransactionOcppMessage =
  new RequestStopTransactionOcppMessage(
    "RequestStopTransaction",
    RequestStopTransactionReqSchema,
    RequestStopTransactionResSchema,
  );
