import type { OcppCall } from "./ocppMessage";

/**
 * Delivery discipline for transaction-related messages, modelled on how OCPP 1.6
 * charge points behave: StartTransaction, StopTransaction and MeterValues are
 * sent strictly in order, one in flight at a time per queue. A CALLERROR or a
 * missing reply is a delivery failure: the same message (same messageId) is
 * retransmitted after `retryIntervalMs`, up to `maxAttempts` times (0 = forever,
 * which is what some deployed 1.6 firmware does), and every later transaction
 * message of that queue waits behind it. Non-transaction messages bypass the
 * queue. `scope` decides whether one connector's stuck message blocks only that
 * connector ("connector") or the whole station ("station").
 */
export type TxQueueScope = "connector" | "station";

export type TxQueueEvent =
  | { kind: "held"; key: string; call: OcppCall; held: number }
  | { kind: "transmit"; key: string; call: OcppCall; attempt: number }
  | { kind: "delivered"; key: string; call: OcppCall; attempts: number }
  | {
      kind: "retry-scheduled";
      key: string;
      call: OcppCall;
      attempt: number;
      reason: string;
      inMs: number;
    }
  | {
      kind: "dropped";
      key: string;
      call: OcppCall;
      attempts: number;
      reason: string;
    };

export interface TxQueueOptions {
  scope: TxQueueScope;
  retryIntervalMs: number;
  /** 0 means unlimited. */
  maxAttempts: number;
  responseTimeoutMs: number;
  isTransactionRelated: (action: string) => boolean;
  connectorOf: (call: OcppCall) => number | undefined;
  transmit: (call: OcppCall) => void;
  onEvent?: (event: TxQueueEvent) => void;
}

interface InFlight {
  call: OcppCall;
  attempts: number;
  timer?: ReturnType<typeof setTimeout>;
  retryScheduled: boolean;
}

interface QueueState {
  key: string;
  pending: OcppCall[];
  inFlight?: InFlight;
  delivered: number;
  dropped: number;
}

export interface TxQueueSnapshot {
  scope: TxQueueScope;
  queues: Array<{
    key: string;
    inFlight: {
      messageId: string;
      action: string;
      attempts: number;
      retryScheduled: boolean;
    } | null;
    held: number;
    delivered: number;
    dropped: number;
  }>;
}

export class TransactionMessageQueue {
  private queues: Map<string, QueueState> = new Map();

  constructor(private readonly opts: TxQueueOptions) {}

  send(call: OcppCall): void {
    if (!this.opts.isTransactionRelated(call.action)) {
      this.opts.transmit(call);
      return;
    }
    const queue = this.queueFor(call);
    queue.pending.push(call);
    if (queue.inFlight) {
      this.emit({
        kind: "held",
        key: queue.key,
        call,
        held: queue.pending.length,
      });
    }
    this.pump(queue);
  }

  onCallResult(messageId: string): boolean {
    const queue = this.queueWithInFlight(messageId);
    if (!queue?.inFlight) {
      return false;
    }
    const { call, attempts, timer } = queue.inFlight;
    clearTimeout(timer);
    queue.inFlight = undefined;
    queue.delivered++;
    this.emit({ kind: "delivered", key: queue.key, call, attempts });
    this.pump(queue);
    return true;
  }

  onCallError(messageId: string, errorCode: string): boolean {
    const queue = this.queueWithInFlight(messageId);
    if (!queue?.inFlight) {
      return false;
    }
    this.onFailure(queue, `CALLERROR ${errorCode}`);
    return true;
  }

  snapshot(): TxQueueSnapshot {
    return {
      scope: this.opts.scope,
      queues: Array.from(this.queues.values()).map((q) => ({
        key: q.key,
        inFlight: q.inFlight
          ? {
              messageId: q.inFlight.call.messageId,
              action: q.inFlight.call.action,
              attempts: q.inFlight.attempts,
              retryScheduled: q.inFlight.retryScheduled,
            }
          : null,
        held: q.pending.length,
        delivered: q.delivered,
        dropped: q.dropped,
      })),
    };
  }

  reset(): void {
    for (const queue of this.queues.values()) {
      clearTimeout(queue.inFlight?.timer);
    }
    this.queues.clear();
  }

  private queueFor(call: OcppCall): QueueState {
    const key =
      this.opts.scope === "station"
        ? "station"
        : `connector:${this.opts.connectorOf(call) ?? "unknown"}`;
    let queue = this.queues.get(key);
    if (!queue) {
      queue = { key, pending: [], delivered: 0, dropped: 0 };
      this.queues.set(key, queue);
    }
    return queue;
  }

  private queueWithInFlight(messageId: string): QueueState | undefined {
    for (const queue of this.queues.values()) {
      if (queue.inFlight?.call.messageId === messageId) {
        return queue;
      }
    }
    return undefined;
  }

  private pump(queue: QueueState): void {
    if (queue.inFlight) {
      return;
    }
    const next = queue.pending.shift();
    if (!next) {
      return;
    }
    queue.inFlight = { call: next, attempts: 0, retryScheduled: false };
    this.transmitInFlight(queue);
  }

  private transmitInFlight(queue: QueueState): void {
    const inFlight = queue.inFlight;
    if (!inFlight) {
      return;
    }
    inFlight.attempts++;
    inFlight.retryScheduled = false;
    this.emit({
      kind: "transmit",
      key: queue.key,
      call: inFlight.call,
      attempt: inFlight.attempts,
    });
    inFlight.timer = setTimeout(
      () => this.onFailure(queue, "no response"),
      this.opts.responseTimeoutMs,
    );
    this.opts.transmit(inFlight.call);
  }

  private onFailure(queue: QueueState, reason: string): void {
    const inFlight = queue.inFlight;
    if (!inFlight) {
      return;
    }
    clearTimeout(inFlight.timer);
    const exhausted =
      this.opts.maxAttempts > 0 && inFlight.attempts >= this.opts.maxAttempts;
    if (exhausted) {
      queue.inFlight = undefined;
      queue.dropped++;
      this.emit({
        kind: "dropped",
        key: queue.key,
        call: inFlight.call,
        attempts: inFlight.attempts,
        reason,
      });
      this.pump(queue);
      return;
    }
    inFlight.retryScheduled = true;
    this.emit({
      kind: "retry-scheduled",
      key: queue.key,
      call: inFlight.call,
      attempt: inFlight.attempts + 1,
      reason,
      inMs: this.opts.retryIntervalMs,
    });
    inFlight.timer = setTimeout(
      () => this.transmitInFlight(queue),
      this.opts.retryIntervalMs,
    );
  }

  private emit(event: TxQueueEvent): void {
    this.opts.onEvent?.(event);
  }
}
