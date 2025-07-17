import type { VCP } from "./vcp";

const METER_VALUES_INTERVAL_SEC = 15;

type TransactionId = string | number;

interface TransactionState {
  startedAt: Date;
  idTag: string;
  transactionId: TransactionId;
  meterValue: number;
  evseId?: number;
  connectorId: number;
  accumulatedEnergyKwh: number; // Track realistic energy accumulation
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

  startTransaction(vcp: VCP, startTransactionProps: StartTransactionProps) {
    const meterValuesTimer = setInterval(() => {
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
      accumulatedEnergyKwh: 0, // Initialize energy accumulation
      meterValuesTimer: meterValuesTimer,
    });
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
    // Return accumulated energy in Wh (will be converted to kWh in the message)
    return transaction.accumulatedEnergyKwh * 1000; // Convert back to Wh for compatibility
  }

  // Add energy to transaction based on power consumption
  addEnergyToTransaction(transactionId: TransactionId, powerW: number, intervalSeconds: number = 15) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return;
    }

    // Calculate energy consumed in this interval: Power (W) × Time (h) = Energy (Wh)
    const energyWh = powerW * (intervalSeconds / 3600); // Convert seconds to hours
    const energyKwh = energyWh / 1000; // Convert to kWh

    // Update accumulated energy
    transaction.accumulatedEnergyKwh += energyKwh;

    // Update the meterValue for compatibility (in Wh)
    transaction.meterValue = transaction.accumulatedEnergyKwh * 1000;
  }
}
