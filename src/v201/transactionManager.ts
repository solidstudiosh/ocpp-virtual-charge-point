import { call } from "../messageFactory";
import { VCP } from "../vcp";

const METER_VALUES_INTERVAL_SEC = 60;

interface TransactionState {
  transactionId: string;
  meterValue: number;
  startedAt: Date;
  evseId: number;
  connectorId: number;
  targetEnergy: number;
  meterValuesTimer?: NodeJS.Timer;
}

export class TransactionManager {
  transactions: Map<string, TransactionState> = new Map();

  startTransaction(
    vcp: VCP,
    transactionId: string,
    evseId: number,
    connectorId: number,
    targetEnergy: number
  ) {
    const meterValuesTimer = setInterval(() => {
    /*
      vcp.send(
        call("TransactionEvent", {
          eventType: "Updated",
          timestamp: new Date(),
          seqNo: 0,
          triggerReason: "MeterValuePeriodic",
          transactionInfo: {
            transactionId: transactionId,
          },
          evse: {
            id: evseId,
            connectorId: connectorId,
          },
          meterValue: [
            {
              timestamp: new Date(),
              sampledValue: [
                {
                  value: this.getMeterValue(transactionId) / 1000,
                  measurand: "Energy.Active.Import.Register",
                  unitOfMeasure: {
                    unit: "kWh",
                  },
                },
              ],
            },
          ],
        })
      );
*/
      vcp.send(
          call("MeterValues", {
            evseId: connectorId,
            meterValue: [
              {
                timestamp: new Date(),
                sampledValue: [
                  {
                    value: (this.getMeterValue(transactionId) / 1000),
                    measurand: "Energy.Active.Import.Register",
                    unitOfMeasure: { unit: "kWh" },
                    context:"Sample.Clock"
                  }
                ],
              },
            ],
          })
      );
    }, METER_VALUES_INTERVAL_SEC * 1000);
    this.transactions.set(transactionId, {
      transactionId: transactionId,
      meterValue: parseInt(process.env["INITIAL_METER_READINGS"] ?? '0'),
      startedAt: new Date(),
      evseId: evseId,
      connectorId: connectorId,
      meterValuesTimer: meterValuesTimer,
      targetEnergy: targetEnergy,
    });
  }

  stopTransaction(transactionId: string) {
    const transaction = this.transactions.get(transactionId);
    if (transaction && transaction.meterValuesTimer) {
      clearInterval(transaction.meterValuesTimer);
    }
    this.transactions.delete(transactionId);
  }

  getMeterValue(transactionId: string) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return 0;
    }
    if (transaction.targetEnergy > 0) {
      return transaction.meterValue + (new Date().getTime() - transaction.startedAt.getTime()) / 100;
    } else {
      // discharging via SetVariables message
      return transaction.meterValue + -((new Date().getTime() - transaction.startedAt.getTime()) / 100);
    }


  }
}

export const transactionManager = new TransactionManager();
