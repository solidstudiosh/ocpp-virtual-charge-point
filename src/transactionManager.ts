interface TransactionState {
  transactionId: string;
  meterValue: number;
  startedAt: Date;
  evseId: number;
  connectorId: number;
}

export class TransactionManager {
  transactions: Map<string, TransactionState> = new Map();

  startTransaction(
    evseId: number,
    connectorId: number,
    transactionId: number | string
  ) {
    this.transactions.set(transactionId.toString(), {
      transactionId: transactionId.toString(),
      meterValue: 0,
      startedAt: new Date(),
      connectorId: connectorId,
      evseId: evseId,
    });
  }

  stopTransaction(transactionId: number | string) {
    this.transactions.delete(transactionId.toString());
  }

  getMeterValue(transactionId: number | string) {
    const transaction = this.transactions.get(transactionId.toString());
    if (!transaction) {
      return 0;
    }
    return (new Date().getTime() - transaction.startedAt.getTime()) / 1000;
  }
}
