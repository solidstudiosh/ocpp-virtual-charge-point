import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { transactionManager } from "../transactionManager";
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
    vcp.respond(
      this.response(call, {
        status: "Accepted",
      }),
    );
    vcp.send(
      transactionEventOcppOutgoing.request({
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
      statusNotificationOcppOutgoing.request({
        evseId: 1,
        connectorId: 1,
        connectorStatus: "Available",
        timestamp: new Date().toISOString(),
      }),
    );
    transactionManager.stopTransaction(call.payload.transactionId);
  };
}

export const requestStopTransactionOcppIncoming =
  new RequestStopTransactionOcppIncoming(
    "RequestStopTransaction",
    RequestStopTransactionReqSchema,
    RequestStopTransactionResSchema,
  );
