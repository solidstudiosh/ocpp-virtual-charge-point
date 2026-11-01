import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import { resolveTokenPlaceholder } from "../../tokenPlaceholder";
import type { VCP } from "../../vcp";
import {
  ConnectorIdSchema,
  DateTimeSchema,
  IdTagInfoSchema,
  IdTagSchema,
} from "./_common";
import { meterValuesOcppMessage } from "./meterValues";
import { statusNotificationOcppMessage } from "./statusNotification";
import { stopTransactionOcppMessage } from "./stopTransaction";

const StartTransactionReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  idTag: IdTagSchema,
  timestamp: DateTimeSchema,
  meterStart: z.number().int(),
});
type StartTransactionReqType = typeof StartTransactionReqSchema;

const StartTransactionResSchema = z.object({
  transactionId: z.number().int(),
  idTagInfo: IdTagInfoSchema,
});
type StartTransactionResType = typeof StartTransactionResSchema;

class StartTransactionOcppMessage extends OcppOutgoing<
  StartTransactionReqType,
  StartTransactionResType
> {
  beforeSend = (
    _vcp: VCP,
    payload: z.infer<StartTransactionReqType>,
  ): z.infer<StartTransactionReqType> => {
    return { ...payload, idTag: resolveTokenPlaceholder(payload.idTag) };
  };

  resHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<StartTransactionReqType>>,
    result: OcppCallResult<z.infer<StartTransactionResType>>,
  ): Promise<void> => {
    const { connectorId } = call.payload;
    const { transactionId } = result.payload;
    if (result.payload.idTagInfo.status !== "Accepted") {
      vcp.send(
        stopTransactionOcppMessage.request({
          transactionId,
          idTag: call.payload.idTag,
          meterStop: 0,
          timestamp: new Date().toISOString(),
        }),
      );
      vcp.send(
        statusNotificationOcppMessage.request({
          connectorId,
          errorCode: "NoError",
          status: "Available",
        }),
      );
      return;
    }
    vcp.transactionManager.startTransaction(vcp, {
      transactionId,
      idTag: call.payload.idTag,
      connectorId,
      meterValuesCallback: async (transactionState) => {
        vcp.send(
          meterValuesOcppMessage.request({
            connectorId,
            values: [
              {
                timestamp: new Date().toISOString(),
                value: Math.floor(transactionState.meterValue),
              },
            ],
          }),
        );
      },
    });
  };
}

export const startTransactionOcppMessage = new StartTransactionOcppMessage(
  "StartTransaction",
  StartTransactionReqSchema,
  StartTransactionResSchema,
);
