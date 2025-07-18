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

        // Calculate transaction duration for realistic progression
        const transactionDurationMinutes = (new Date().getTime() - new Date(transactionState.startedAt).getTime()) / (1000 * 60);

        // Simulate realistic readings based on Tesla Wall Connector specs during charging
        // Start with gradual current ramp-up from 0 to max current (realistic EV charging behavior)
        const rampUpTimeMinutes = parseFloat(process.env.CHARGING_RAMP_UP_TIME_MINUTES ?? "2.0"); // Time to reach max current
        const currentRampProgress = Math.min(1, transactionDurationMinutes / rampUpTimeMinutes); // 0 to 1 over ramp time
        const targetCurrent = maxCurrent * currentRampProgress; // Gradually increase from 0 to max

        // Add some realistic variation (±10%) once we're past initial ramp-up
        const variationFactor = currentRampProgress > 0.1 ? 0.1 : 0; // No variation during initial ramp-up
        const currentL1 = (targetCurrent + (Math.random() - 0.5) * targetCurrent * variationFactor).toFixed(1);
        const currentL2 = (targetCurrent + (Math.random() - 0.5) * targetCurrent * variationFactor).toFixed(1);
        const currentL3 = (targetCurrent + (Math.random() - 0.5) * targetCurrent * variationFactor).toFixed(1);

        // Voltage with ±5% variation
        const voltage = (baseVoltage + (Math.random() - 0.5) * baseVoltage * 0.1).toFixed(1);

        // Calculate power based on actual current and voltage (3-phase)
        const avgCurrent = (Number(currentL1) + Number(currentL2) + Number(currentL3)) / 3;
        const power = (avgCurrent * Number(voltage) * Math.sqrt(3)).toFixed(0);

        // Simulate realistic SoC progression during charging (increases over time)
        const baseSoC = parseInt(process.env.CAR_STARTING_SOC ?? "25"); // Starting SoC
        const chargingRatePerMinute = parseFloat(process.env.CAR_CHARGING_SOC_RATE_PER_MINUTE ?? "0.5"); // SoC increase per minute
        const maxSoC = parseInt(process.env.CAR_CHARGING_TO_MAX_SOC ?? "80"); // Maximum SoC
        const currentSoC = Math.min(maxSoC, baseSoC + (transactionDurationMinutes * chargingRatePerMinute));
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
