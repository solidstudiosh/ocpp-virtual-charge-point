import * as uuid from "uuid";
import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  ChargingProfileSchema,
  IdTokenTypeSchema,
  StatusInfoTypeSchema,
} from "./_common";
import { statusNotificationOcppOutgoing } from "./statusNotification";
import { transactionEventOcppOutgoing } from "./transactionEvent";

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

class RequestStartTransactionOcppIncoming extends OcppIncoming<
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
    vcp.transactionManager.startTransaction(vcp, {
      transactionId: transactionId,
      idTag: call.payload.idToken.idToken,
      evseId: transactionEvseId,
      connectorId: transactionConnectorId,
      meterValuesCallback: async (transactionStatus) => {
        // Get max current and voltage from environment variables for realistic readings during transaction
        const maxCurrent = Number(process.env.MAX_CURRENT_A ?? "32");
        const baseVoltage = Number(process.env.VOLTAGE_V ?? "230");

        // Calculate transaction duration for realistic progression
        const transactionDurationMinutes = (new Date().getTime() - new Date(transactionStatus.startedAt).getTime()) / (1000 * 60);

        // Simulate realistic readings based on Tesla Wall Connector specs during charging
        // Start with gradual current ramp-up from 0 to max current (realistic EV charging behavior)
        const rampUpTimeMinutes = parseFloat(process.env.CHARGING_RAMP_UP_TIME_MINUTES ?? "2.0"); // Time to reach max current
        const currentRampProgress = Math.min(1, transactionDurationMinutes / rampUpTimeMinutes); // 0 to 1 over ramp time
        const targetCurrent = maxCurrent * currentRampProgress; // Gradually increase from 0 to max

        // Add some realistic variation (±10%) once we're past initial ramp-up
        const variationFactor = currentRampProgress > 0.1 ? 0.1 : 0; // No variation during initial ramp-up
        const currentL1 = Number((targetCurrent + (Math.random() - 0.5) * targetCurrent * variationFactor).toFixed(1));
        const currentL2 = Number((targetCurrent + (Math.random() - 0.5) * targetCurrent * variationFactor).toFixed(1));
        const currentL3 = Number((targetCurrent + (Math.random() - 0.5) * targetCurrent * variationFactor).toFixed(1));

        // Voltage with ±5% variation
        const voltage = Number((baseVoltage + (Math.random() - 0.5) * baseVoltage * 0.1).toFixed(1));

        // Calculate power based on actual current and voltage (3-phase)
        const avgCurrent = (currentL1 + currentL2 + currentL3) / 3;
        const power = Number((avgCurrent * voltage * Math.sqrt(3)).toFixed(0));

        // Simulate realistic SoC progression during charging (increases over time)
        const baseSoC = parseInt(process.env.CAR_STARTING_SOC ?? "25"); // Starting SoC
        const chargingRatePerMinute = parseFloat(process.env.CAR_CHARGING_SOC_RATE_PER_MINUTE ?? "0.5"); // SoC increase per minute
        const maxSoC = parseInt(process.env.CAR_CHARGING_TO_MAX_SOC ?? "80"); // Maximum SoC
        const currentSoC = Math.min(maxSoC, baseSoC + (transactionDurationMinutes * chargingRatePerMinute));
        const soc = Number(currentSoC.toFixed(1));

        // Add this power consumption to the transaction's energy accumulation
        vcp.transactionManager.addEnergyToTransaction(transactionId, power, 15);

        vcp.send(
          transactionEventOcppOutgoing.request({
            eventType: "Updated",
            timestamp: new Date().toISOString(),
            seqNo: 0,
            triggerReason: "MeterValuePeriodic",
            transactionInfo: {
              transactionId: transactionId,
            },
            evse: {
              id: transactionEvseId,
              connectorId: transactionConnectorId,
            },
            meterValue: [
              {
                timestamp: new Date().toISOString(),
                sampledValue: [
                  {
                    value: currentL1,
                    measurand: "Current.Import",
                    phase: "L1",
                    unitOfMeasure: { unit: "A" },
                  },
                  {
                    value: currentL2,
                    measurand: "Current.Import",
                    phase: "L2",
                    unitOfMeasure: { unit: "A" },
                  },
                  {
                    value: currentL3,
                    measurand: "Current.Import",
                    phase: "L3",
                    unitOfMeasure: { unit: "A" },
                  },
                  {
                    value: voltage,
                    measurand: "Voltage",
                    unitOfMeasure: { unit: "V" },
                  },
                  {
                    value: power,
                    measurand: "Power.Active.Import",
                    unitOfMeasure: { unit: "W" },
                  },
                  {
                    value: transactionStatus.meterValue,
                    measurand: "Energy.Active.Import.Register",
                    unitOfMeasure: {
                      unit: "kWh",
                    },
                  },
                  {
                    value: soc,
                    measurand: "SoC",
                    unitOfMeasure: {
                      unit: "%",
                    },
                  },
                ],
              },
            ],
          }),
        );
      },
    });
    vcp.respond(
      this.response(call, {
        status: "Accepted",
      }),
    );

    // Send "Occupied" first (cable connected)
    vcp.send(
      statusNotificationOcppOutgoing.request({
        evseId: transactionEvseId,
        connectorId: transactionConnectorId,
        connectorStatus: "Occupied",
        timestamp: new Date().toISOString(),
      }),
    );

    // Send TransactionEvent "Started" immediately
    vcp.send(
      transactionEventOcppOutgoing.request({
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

    // Wait briefly then send "Charging" status
    setTimeout(() => {
      vcp.send(
        statusNotificationOcppOutgoing.request({
          evseId: transactionEvseId,
          connectorId: transactionConnectorId,
          connectorStatus: "Charging",
          timestamp: new Date().toISOString(),
        }),
      );
    }, 500);
  };
}

export const requestStartTransactionOcppIncoming =
  new RequestStartTransactionOcppIncoming(
    "RequestStartTransaction",
    RequestStartTransactionReqSchema,
    RequestStartTransactionResSchema,
  );
