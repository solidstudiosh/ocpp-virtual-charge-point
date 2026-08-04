import type { VCP } from "./vcp";

const METER_VALUES_INTERVAL_SEC = 15;

// Periodic MeterValues are sent for every ongoing transaction. Set
// DISABLE_METER_VALUES=true to stop sending them - useful when they only add
// noise, or when the values are driven by admin commands instead.
const METER_VALUES_DISABLED = process.env.DISABLE_METER_VALUES === "true";

type TransactionId = string | number;

interface TransactionState {
  startedAt: Date;
  idTag: string;
  transactionId: TransactionId;
  meterValue: number;
  evseId?: number;
  connectorId: number;
}

interface StartTransactionProps {
  transactionId: TransactionId;
  idTag: string;
  evseId?: number;
  connectorId: number;
  meterValuesCallback: (transactionState: TransactionState) => Promise<void>;
}

export class TransactionManager {
  transactions: Map<
    TransactionId,
    TransactionState & { meterValuesTimer?: ReturnType<typeof setInterval> }
  > = new Map();

  canStartNewTransaction(connectorId: number) {
    return !Array.from(this.transactions.values()).some(
      (transaction) => transaction.connectorId === connectorId,
    );
  }

  startTransaction(vcp: VCP, startTransactionProps: StartTransactionProps) {
    // No timer at all when disabled, rather than one that wakes up to do
    // nothing.
    const meterValuesTimer = METER_VALUES_DISABLED
      ? undefined
      : setInterval(() => {
          // biome-ignore lint/style/noNonNullAssertion: transaction must exist
          const currentTransactionState = this.transactions.get(
            startTransactionProps.transactionId,
          )!;
          const { meterValuesTimer, ...currentTransaction } =
            currentTransactionState;
          startTransactionProps.meterValuesCallback({
            ...currentTransaction,
            meterValue: this.getMeterValue(startTransactionProps.transactionId),
          });
        }, METER_VALUES_INTERVAL_SEC * 1000);
    this.transactions.set(startTransactionProps.transactionId, {
      transactionId: startTransactionProps.transactionId,
      idTag: startTransactionProps.idTag,
      meterValue: 0,
      startedAt: new Date(),
      evseId: startTransactionProps.evseId,
      connectorId: startTransactionProps.connectorId,
      meterValuesTimer: meterValuesTimer,
    });
  }

  /**
   * The id of the only ongoing transaction, or undefined when there is no
   * transaction or more than one - i.e. when it would be ambiguous.
   */
  onlyTransactionId(): TransactionId | undefined {
    if (this.transactions.size !== 1) {
      return undefined;
    }
    return this.transactions.keys().next().value;
  }

  stopTransaction(transactionId: TransactionId) {
    const transaction = this.transactions.get(transactionId);
    if (transaction?.meterValuesTimer) {
      clearInterval(transaction.meterValuesTimer);
    }
    this.transactions.delete(transactionId);
  }

  getMeterValue(transactionId: TransactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return 0;
    }
    return (new Date().getTime() - transaction.startedAt.getTime()) / 100;
  }
}
