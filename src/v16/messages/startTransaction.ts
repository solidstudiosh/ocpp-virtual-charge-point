import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, IdTagInfoSchema, IdTokenSchema } from "./_common";
import { meterValuesOcppMessage } from "./meterValues";

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
    console.log(`🔋 Starting charging transaction ${result.payload.transactionId} on connector ${call.payload.connectorId}`);
    console.log(`�️  Shutdown protection active - Ctrl+C blocked during charging`);

    vcp.transactionManager.startTransaction(vcp, {
      transactionId: result.payload.transactionId,
      idTag: call.payload.idTag,
      connectorId: call.payload.connectorId,
      meterValuesCallback: async (transactionState) => {
        // Get max current and voltage from environment variables for realistic readings during transaction
        const maxCurrent = Number(process.env.MAX_CURRENT_A ?? "32");
        const baseVoltage = Number(process.env.VOLTAGE_V ?? "230");

        // Simulate realistic readings based on Tesla Wall Connector specs during charging
        const currentL1 = (Math.random() * maxCurrent * 0.3 + maxCurrent * 0.7).toFixed(1); // 70-100% of max current
        const currentL2 = (Math.random() * maxCurrent * 0.3 + maxCurrent * 0.7).toFixed(1);
        const currentL3 = (Math.random() * maxCurrent * 0.3 + maxCurrent * 0.7).toFixed(1);

        // Voltage with ±5% variation
        const voltage = (baseVoltage + (Math.random() - 0.5) * baseVoltage * 0.1).toFixed(1);

        // Calculate power based on actual current and voltage (3-phase)
        const avgCurrent = (Number(currentL1) + Number(currentL2) + Number(currentL3)) / 3;
        const power = (avgCurrent * Number(voltage) * Math.sqrt(3)).toFixed(0);

        // Simulate realistic SoC progression during charging (increases over time)
        const transactionDurationMinutes = (new Date().getTime() - new Date(transactionState.startedAt).getTime()) / (1000 * 60);
        const baseSoC = 25; // Starting SoC
        const chargingRatePerMinute = 0.5; // ~0.5% per minute (realistic for fast charging)
        const currentSoC = Math.min(95, baseSoC + (transactionDurationMinutes * chargingRatePerMinute));
        const soc = currentSoC.toFixed(1);

        // Add this power consumption to the transaction's energy accumulation
        vcp.transactionManager.addEnergyToTransaction(result.payload.transactionId, Number(power), 15);

        vcp.send(
          meterValuesOcppMessage.request({
            connectorId: call.payload.connectorId,
            transactionId: result.payload.transactionId,
            meterValue: [
              {
                timestamp: new Date().toISOString(),
                sampledValue: [
                  {
                    value: currentL1,
                    measurand: "Current.Import",
                    phase: "L1",
                    unit: "A",
                  },
                  {
                    value: currentL2,
                    measurand: "Current.Import",
                    phase: "L2",
                    unit: "A",
                  },
                  {
                    value: currentL3,
                    measurand: "Current.Import",
                    phase: "L3",
                    unit: "A",
                  },
                  {
                    value: voltage,
                    measurand: "Voltage",
                    unit: "V",
                  },
                  {
                    value: power,
                    measurand: "Power.Active.Import",
                    unit: "W",
                  },
                  {
                    value: (transactionState.meterValue / 1000).toString(),
                    measurand: "Energy.Active.Import.Register",
                    unit: "kWh",
                  },
                  {
                    value: soc,
                    measurand: "SoC",
                    unit: "Percent",
                  },
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
