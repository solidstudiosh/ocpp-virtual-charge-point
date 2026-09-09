import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "../messageFactory";
import type { OcppCall } from "../ocppMessage";
import {
  TransactionMessageQueue,
  type TxQueueOptions,
} from "../transactionMessageQueue";

const TX_ACTIONS = new Set([
  "StartTransaction",
  "StopTransaction",
  "MeterValues",
]);

function makeQueue(overrides: Partial<TxQueueOptions> = {}) {
  const sent: OcppCall[] = [];
  const queue = new TransactionMessageQueue({
    scope: "connector",
    retryIntervalMs: 5_000,
    maxAttempts: 0,
    responseTimeoutMs: 30_000,
    isTransactionRelated: (action) => TX_ACTIONS.has(action),
    connectorOf: (c) => c.payload?.connectorId,
    transmit: (c) => sent.push(c),
    ...overrides,
  });
  return { queue, sent };
}

const mv = (connectorId: number) =>
  call("MeterValues", { connectorId, transactionId: 1, meterValue: [] });

describe("TransactionMessageQueue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("transmits non-transaction messages immediately, even while a transaction message is in flight", () => {
    const { queue, sent } = makeQueue();
    queue.send(mv(1));
    queue.send(call("Heartbeat", {}));
    expect(sent.map((c) => c.action)).toEqual(["MeterValues", "Heartbeat"]);
  });

  it("holds the next transaction message of a connector until the previous one is acknowledged", () => {
    const { queue, sent } = makeQueue();
    const first = mv(1);
    const second = mv(1);
    queue.send(first);
    queue.send(second);
    expect(sent).toHaveLength(1);
    queue.onCallResult(first.messageId);
    expect(sent).toHaveLength(2);
    expect(sent[1].messageId).toBe(second.messageId);
  });

  it("retransmits the same message after a CALLERROR once the retry interval elapsed, keeping later messages held", () => {
    const { queue, sent } = makeQueue({ retryIntervalMs: 5_000 });
    const first = mv(1);
    queue.send(first);
    queue.send(mv(1));
    queue.onCallError(first.messageId, "GenericError");
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(4_999);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sent).toHaveLength(2);
    expect(sent[1].messageId).toBe(first.messageId);
    expect(queue.snapshot().queues[0]).toMatchObject({
      inFlight: { messageId: first.messageId, attempts: 2 },
      held: 1,
    });
  });

  it("keeps a stuck connector from blocking another connector when scope is connector", () => {
    const { queue, sent } = makeQueue();
    const stuck = mv(1);
    queue.send(stuck);
    queue.onCallError(stuck.messageId, "GenericError");
    const other = mv(2);
    queue.send(other);
    expect(sent.map((c) => c.messageId)).toContain(other.messageId);
  });

  it("uses one queue for every connector when scope is station", () => {
    const { queue, sent } = makeQueue({ scope: "station" });
    const stuck = mv(1);
    queue.send(stuck);
    queue.onCallError(stuck.messageId, "GenericError");
    queue.send(mv(2));
    expect(sent).toHaveLength(1);
  });

  it("drops the message after maxAttempts failures and moves on to the next one", () => {
    const { queue, sent } = makeQueue({
      maxAttempts: 2,
      retryIntervalMs: 1_000,
    });
    const first = mv(1);
    const second = mv(1);
    queue.send(first);
    queue.send(second);
    queue.onCallError(first.messageId, "GenericError"); // attempt 1 failed
    vi.advanceTimersByTime(1_000); // attempt 2 transmitted
    queue.onCallError(first.messageId, "GenericError"); // attempt 2 failed -> drop
    expect(sent.map((c) => c.messageId)).toEqual([
      first.messageId,
      first.messageId,
      second.messageId,
    ]);
    expect(queue.snapshot().queues[0]).toMatchObject({ dropped: 1, held: 0 });
  });

  it("treats a missing response as a failure and retries after the response timeout", () => {
    const { queue, sent } = makeQueue({
      responseTimeoutMs: 10_000,
      retryIntervalMs: 2_000,
    });
    const first = mv(1);
    queue.send(first);
    vi.advanceTimersByTime(10_000 + 2_000);
    expect(sent.map((c) => c.messageId)).toEqual([
      first.messageId,
      first.messageId,
    ]);
  });

  it("ignores replies for messages it does not track", () => {
    const { queue } = makeQueue();
    expect(queue.onCallResult("nope")).toBe(false);
    expect(queue.onCallError("nope", "GenericError")).toBe(false);
  });
});
