import { z } from "zod";
import { generateOCMF, getOCMFPublicKey } from "../../ocmfGenerator";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, IdTagInfoSchema, IdTokenSchema } from "./_common";
import { meterValuesOcppMessage } from "./meterValues";

// Meters that publish OCMF mid-transaction attach a signed document to their periodic readings, not
// just to the closing one. Set SIGNED_METER_VALUES=true to reproduce that shape.
const SIGNED_METER_VALUES = process.env.SIGNED_METER_VALUES === "true";

function signedMeterSample(transaction: {
  startedAt: Date;
  idTag: string;
  meterValue: number;
}) {
  const ocmf = generateOCMF({
    startTime: transaction.startedAt,
    startEnergy: 0,
    endTime: new Date(),
    endEnergy: transaction.meterValue / 1000,
    idTag: transaction.idTag,
  });
  return {
    value: JSON.stringify({
      signedMeterData: Buffer.from(ocmf).toString("base64"),
      encodingMethod: "OCMF",
      publicKey: getOCMFPublicKey().toString("base64"),
    }),
    format: "SignedData" as const,
    context: "Sample.Periodic" as const,
  };
}

const StartTransactionReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  idTag: IdTokenSchema,
  meterStart: z.number().int(),
  reservationId: z.number().int().nullish(),
  timestamp: z.string().datetime(),
});
type StartTransactionReqType = typeof StartTransactionReqSchema;

const StartTransactionResSchema = z.object({
  idTagInfo: IdTagInfoSchema,
  transactionId: z.number().int(),
});
type StartTransactionResType = typeof StartTransactionResSchema;

class StartTransactionOcppMessage extends OcppOutgoing<
  StartTransactionReqType,
  StartTransactionResType
> {
  resHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<StartTransactionReqType>>,
    result: OcppCallResult<z.infer<StartTransactionResType>>,
  ): Promise<void> => {
    vcp.transactionManager.startTransaction(vcp, {
      transactionId: result.payload.transactionId,
      idTag: call.payload.idTag,
      connectorId: call.payload.connectorId,
      meterValuesCallback: async (transactionState) => {
        vcp.send(
          meterValuesOcppMessage.request({
            connectorId: call.payload.connectorId,
            transactionId: result.payload.transactionId,
            meterValue: [
              {
                timestamp: new Date().toISOString(),
                sampledValue: [
                  {
                    value: (transactionState.meterValue / 1000).toString(),
                    measurand: "Energy.Active.Import.Register",
                    unit: "kWh",
                  },
                  ...(SIGNED_METER_VALUES
                    ? [signedMeterSample(transactionState)]
                    : []),
                ],
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
