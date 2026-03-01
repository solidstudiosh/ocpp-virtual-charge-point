import type { VCP } from "./vcp";
import { dbService } from "./database";
import { logger } from "./logger";

const METER_VALUES_INTERVAL_SEC = 15;

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
    TransactionState & { meterValuesTimer: NodeJS.Timeout }
  > = new Map();

  canStartNewTransaction(connectorId: number) {
    return !Array.from(this.transactions.values()).some(
      (transaction) => transaction.connectorId === connectorId,
    );
  }

  async loadTransactions(vcp: VCP, meterValuesCallback: (transactionState: TransactionState) => Promise<void>) {
    const activeTx = dbService.getActiveTransactions();
    for (const tx of activeTx) {
      logger.info(`Resuming transaction ${tx.transactionId} for connector ${tx.connectorId}`);
      this.startTransaction(vcp, {
        transactionId: tx.transactionId,
        idTag: tx.idTag,
        connectorId: tx.connectorId,
        evseId: tx.evseId,
        meterValuesCallback,
      }, true);
    }
  }

  startTransaction(vcp: VCP, startTransactionProps: StartTransactionProps, isResuming = false) {
    const meterValuesTimer = setInterval(() => {
      const currentTransactionState = this.transactions.get(
        startTransactionProps.transactionId,
      )!;
      const { meterValuesTimer, ...currentTransaction } =
        currentTransactionState;

      const newMeterValue = this.getMeterValue(startTransactionProps.transactionId);
      dbService.updateTransactionMeter(startTransactionProps.transactionId, newMeterValue);

      startTransactionProps.meterValuesCallback({
        ...currentTransaction,
        meterValue: newMeterValue,
      });
    }, METER_VALUES_INTERVAL_SEC * 1000);

    const transactionState = {
      transactionId: startTransactionProps.transactionId,
      idTag: startTransactionProps.idTag,
      meterValue: isResuming ? 0 : 0, // In resume case, we could pull existing meter value if needed
      startedAt: isResuming ? new Date() : new Date(), // Simulating fresh start for simplicity, but could be restored
      evseId: startTransactionProps.evseId,
      connectorId: startTransactionProps.connectorId,
      meterValuesTimer: meterValuesTimer,
    };

    if (!isResuming) {
      dbService.saveTransaction({
        transactionId: startTransactionProps.transactionId.toString(),
        idTag: startTransactionProps.idTag,
        connectorId: startTransactionProps.connectorId,
        evseId: startTransactionProps.evseId,
        startedAt: transactionState.startedAt.toISOString(),
        meterValue: 0,
        status: "Active"
      });
    }

    this.transactions.set(startTransactionProps.transactionId, transactionState);
  }

  stopTransaction(transactionId: TransactionId) {
    const transaction = this.transactions.get(transactionId);
    if (transaction?.meterValuesTimer) {
      clearInterval(transaction.meterValuesTimer);
    }
    dbService.closeTransaction(transactionId);
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
