import type { VCP } from "../vcp";
import { meterValuesOcppMessage } from "./messages/meterValues";

const METER_VALUES_INTERVAL_SEC = 15;

interface TransactionState {
  transactionId: number;
  meterValue: number;
  startedAt: Date;
  connectorId: number;
  meterValuesTimer?: NodeJS.Timer;
}

export class TransactionManager {
  transactions: Map<string, TransactionState> = new Map();

  canStartNewTransaction(connectorId: number) {
    return !Array.from(this.transactions.values()).some(
      (transaction) => transaction.connectorId === connectorId,
    );
  }

  startTransaction(vcp: VCP, transactionId: number, connectorId: number) {
    const meterValuesTimer = setInterval(() => {
      vcp.send(
        meterValuesOcppMessage.request({
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                {
                  value: (this.getMeterValue(transactionId) / 1000).toString(),
                  measurand: "Energy.Active.Import.Register",
                  unit: "kWh",
                },
              ],
            },
          ],
        }),
      );
    }, METER_VALUES_INTERVAL_SEC * 1000);
    this.transactions.set(transactionId.toString(), {
      transactionId: transactionId,
      meterValue: 0,
      startedAt: new Date(),
      connectorId: connectorId,
      meterValuesTimer: meterValuesTimer,
    });
  }

  stopTransaction(transactionId: number) {
    const transaction = this.transactions.get(transactionId.toString());
    if (transaction?.meterValuesTimer) {
      clearInterval(transaction.meterValuesTimer);
    }
    this.transactions.delete(transactionId.toString());
  }

  getMeterValue(transactionId: number) {
    const transaction = this.transactions.get(transactionId.toString());
    if (!transaction) {
      return 0;
    }
    return (new Date().getTime() - transaction.startedAt.getTime()) / 100;
  }
}

export const transactionManager = new TransactionManager();
