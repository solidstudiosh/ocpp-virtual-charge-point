import type { VCP } from "./vcp";
import { dbService } from "./database";
import { logger } from "./logger";

const METER_VALUES_INTERVAL_SEC = 15;

type TransactionId = string | number;

interface TransactionState {
  startedAt: Date;
  idTag: string;
  transactionId: TransactionId;
  meterValue: number; // Wh
  evseId?: number;
  connectorId: number;

  // EV Battery Simulation
  soc: number; // State of Charge (0-100%)
  batteryCapacityWh: number; // Total battery capacity
  maxChargingRateW: number; // Max rate of the charger/EV
  smartChargingLimitW?: number; // Active limit from SetChargingProfile
}

interface StartTransactionProps {
  transactionId: TransactionId;
  idTag: string;
  evseId?: number;
  connectorId: number;
  initialMeterValue?: number;
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
        initialMeterValue: tx.meterValue,
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

      // EV Battery Simulation logic
      // Determine active charging limit (min between hardware max and smart profile)
      let activeLimitW = currentTransaction.maxChargingRateW;
      if (currentTransaction.smartChargingLimitW !== undefined) {
        // If limit is negative (V2G/Discharging), bound it by hardware max implicitly (-maxChargingRateW)
        if (currentTransaction.smartChargingLimitW < 0) {
          activeLimitW = Math.max(-currentTransaction.maxChargingRateW, currentTransaction.smartChargingLimitW);
        } else {
          activeLimitW = Math.min(currentTransaction.maxChargingRateW, currentTransaction.smartChargingLimitW);
        }
      }

      // Simulate charging/discharging curve
      let curveFactor = 1.0;
      if (activeLimitW >= 0) {
        if (currentTransaction.soc > 80) curveFactor = 0.5; // 80-90% slower
        if (currentTransaction.soc > 90) curveFactor = 0.2; // 90-100% very slow
        if (currentTransaction.soc >= 100) curveFactor = 0; // Full
      } else {
        // Discharging (V2G)
        if (currentTransaction.soc < 20) curveFactor = 0.5; // slow down when low
        if (currentTransaction.soc < 10) curveFactor = 0.2; // very slow
        if (currentTransaction.soc <= 0) curveFactor = 0;   // empty
      }

      const powerW = activeLimitW * curveFactor;
      const energyAddedWh = powerW * (METER_VALUES_INTERVAL_SEC / 3600); // Wh = W * hours

      // Update state
      currentTransactionState.meterValue += energyAddedWh; // Net energy
      currentTransactionState.soc = Math.max(0, Math.min(100, currentTransactionState.soc + (energyAddedWh / currentTransactionState.batteryCapacityWh) * 100));

      dbService.updateTransactionMeter(startTransactionProps.transactionId, currentTransactionState.meterValue);

      startTransactionProps.meterValuesCallback({
        ...currentTransactionState,
      });
    }, METER_VALUES_INTERVAL_SEC * 1000);

    const transactionState: TransactionState & { meterValuesTimer: NodeJS.Timeout } = {
      transactionId: startTransactionProps.transactionId,
      idTag: startTransactionProps.idTag,
      meterValue: startTransactionProps.initialMeterValue || 0,
      startedAt: isResuming ? new Date() : new Date(),
      evseId: startTransactionProps.evseId,
      connectorId: startTransactionProps.connectorId,
      soc: isResuming ? Math.min(100, 20 + ((startTransactionProps.initialMeterValue || 0) / 50000) * 100) : 20, // Start at 20%
      batteryCapacityWh: 50000, // Simulate a 50 kWh battery
      maxChargingRateW: 22000, // Simulate a 22 kW charger
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
    return transaction.meterValue;
  }

  setSmartChargingLimit(connectorId: number, limitW?: number) {
    for (const tx of this.transactions.values()) {
      if (tx.connectorId === connectorId || connectorId === 0) {
        tx.smartChargingLimitW = limitW;
      }
    }
  }
}
