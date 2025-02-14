import * as uuid from "uuid";
import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { transactionManager } from "../transactionManager";
import {
  ChargingProfileSchema,
  IdTokenTypeSchema,
  StatusInfoTypeSchema,
} from "./_common";
import { statusNotificationOcppMessage } from "./statusNotification";
import { transactionEventOcppMessage } from "./transactionEvent";

const RequestStartTransactionReqSchema = z.object({
  evseId: z.number().int().nullish(),
  remoteStartId: z.number().int(),
  idToken: IdTokenTypeSchema,
  chargingProfile: ChargingProfileSchema.nullish(),
  groupIdToken: IdTokenTypeSchema.nullish(),
});
type RequestStartTransactionReqType = typeof RequestStartTransactionReqSchema;

const RequestStartTransactionResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  transactionId: z.string().max(36).nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type RequestStartTransactionResType = typeof RequestStartTransactionResSchema;

class RequestStartTransactionOcppMessage extends OcppMessage<
  RequestStartTransactionReqType,
  RequestStartTransactionResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<RequestStartTransactionReqType>>,
  ): Promise<void> => {
    const transactionId = uuid.v4();
    const transactionEvseId = call.payload.evseId ?? 1;
    const transactionConnectorId = 1;
    transactionManager.startTransaction(
      vcp,
      transactionId,
      transactionEvseId,
      transactionConnectorId,
    );
    vcp.respond(
      this.response(call, {
        status: "Accepted",
      }),
    );
    vcp.send(
      statusNotificationOcppMessage.request({
        evseId: transactionEvseId,
        connectorId: transactionConnectorId,
        connectorStatus: "Occupied",
        timestamp: new Date().toISOString(),
      }),
    );
    vcp.send(
      transactionEventOcppMessage.request({
        eventType: "Started",
        timestamp: new Date().toISOString(),
        seqNo: 0,
        triggerReason: "Authorized",
        transactionInfo: {
          transactionId: transactionId,
        },
        idToken: call.payload.idToken,
        evse: {
          id: transactionEvseId,
          connectorId: transactionConnectorId,
        },
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [
              {
                value: 0,
                measurand: "Energy.Active.Import.Register",
                unitOfMeasure: {
                  unit: "kWh",
                },
              },
            ],
          },
        ],
      }),
    );
  };
}

export const requestStartTransactionOcppMessage =
  new RequestStartTransactionOcppMessage(
    "RequestStartTransaction",
    RequestStartTransactionReqSchema,
    RequestStartTransactionResSchema,
  );
