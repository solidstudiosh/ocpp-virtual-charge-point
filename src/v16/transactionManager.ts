import { call } from "../messageFactory";
import { VCP } from "../vcp";

const METER_VALUES_INTERVAL_SEC = 60;

interface TransactionState {
  transactionId: number;
  meterValue: number;
  startedAt: Date;
  connectorId: number;
  meterValuesTimer?: NodeJS.Timer;
}

export class TransactionManager {
  private static transactionCount = 0;

  transactions: Map<string, TransactionState> = new Map();
  vcpTransactionMap: Map<VCP, number> = new Map();
  startTransaction(
    vcp: VCP,
    transactionId: number,
    connectorId: number
  ) {
    const meterValuesTimer = setInterval(() => {
      vcp.send(
        call("MeterValues", {
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: [
            {
              timestamp: new Date(),
              sampledValue: [
                {
                  value: (this.getMeterValue(transactionId)).toString(),
                  measurand: "Energy.Active.Import.Register",
                  unit: "Wh",
                },
                {
                  value: "28.67",
                  measurand: "Current.Import",
                  unit: "A",
                },
                {
                  measurand: "Voltage",
                  unit: "V",
                  phase: "L1",
                  value: "247",
                  context: "Sample.Periodic",
                  location: "Outlet"
                }
              ],
            },
          ],
        })
      );
    }, METER_VALUES_INTERVAL_SEC * 1000);
    // console.log(parseInt(process.env["INITIAL_METER_READINGS"] ?? '0'));
    this.transactions.set(transactionId.toString(), {
      transactionId: transactionId,
      meterValue: parseInt(process.env["INITIAL_METER_READINGS"] ?? '0'),
      startedAt: new Date(),
      connectorId: connectorId,
      meterValuesTimer: meterValuesTimer,
    });
    // set vcp mapping for transactions
    this.vcpTransactionMap.set(vcp, transactionId);

    console.log(`connectorID: ${connectorId}, transactionID: ${transactionId}`)
    // for (const [key, value] of this.transactions.entries()) {
    //   console.log(`Key: ${key}`);
    //   console.log('Value:');
    //   console.log(value);
    // }
    TransactionManager.transactionCount++;
    console.log(`connectorID: ${connectorId}, transaction counts: ${TransactionManager.transactionCount}`)

  return transactionId;
  }

  stopTransaction(transactionId: number) {
    const transaction = this.transactions.get(transactionId.toString())
    //  || this.transactions.entries().next().value;
    if (transaction && transaction.meterValuesTimer) {
      console.log(`Clearing interval for transaction ${transactionId}`);
      clearInterval(transaction.meterValuesTimer);
    }
    this.transactions.delete(transactionId.toString());
  }

  getMeterValue(transactionId: number) {
    const transaction = this.transactions.get(transactionId.toString());
    if (!transaction) {
      return 0;
    }
    // make meterValue not a neat round number
    let meterValue = transaction.meterValue + ((new Date().getTime() - transaction.startedAt.getTime()) / 100);
    meterValue *= 1.24;
    meterValue = Math.round(meterValue);
    console.log(`getMeterValue meterValue: ${meterValue}`)
    return meterValue;
  }

  getTransactionIdByVcp(vcp: VCP): number | undefined {
    return this.vcpTransactionMap.get(vcp);
  }
}

export const transactionManager = new TransactionManager();
