/**
 * Deterministic core of the multi-round TUI driver: rounds of
 * begin → run batch → show summary → (again | quit), kept free of Ink and
 * process concerns so the loop semantics are unit-testable. The entry point
 * wires the queues to App callbacks and races them against Ink's exit.
 */

export interface BeginPayload {
  files: string[];
  idTagOverride?: string;
}

export type RoundChoice = "again" | "quit";

export interface AsyncQueue<T> {
  push(value: T): void;
  next(): Promise<T>;
}

/** Unbounded producer/consumer queue: push() feeds pending or future next(). */
export function asyncQueue<T>(): AsyncQueue<T> {
  const buffer: T[] = [];
  const waiters: ((value: T) => void)[] = [];
  return {
    push(value: T) {
      const waiter = waiters.shift();
      if (waiter) waiter(value);
      else buffer.push(value);
    },
    next() {
      if (buffer.length > 0) {
        // biome-ignore lint/style/noNonNullAssertion: length checked above
        return Promise.resolve(buffer.shift()!);
      }
      return new Promise<T>((resolve) => {
        waiters.push(resolve);
      });
    },
  };
}

export interface BatchLoopDeps {
  /** Next begin payload; undefined means the UI exited — stop the loop. */
  nextBegin: () => Promise<BeginPayload | undefined>;
  /** Summary-screen choice; undefined (UI exited) is treated as quit. */
  nextChoice: () => Promise<RoundChoice | undefined>;
  /** Run one batch over the payload's files; resolves the worst exit code. */
  runBatch: (payload: BeginPayload) => Promise<number>;
  /** Flip the UI to the post-run summary screen. */
  showSummary: () => void;
}

/**
 * Run begin/summary rounds until the user quits (or the UI exits). Returns
 * the exit code of the LAST round — a re-run that succeeds exits 0 even if
 * an earlier round failed.
 */
export async function runBatchLoop(deps: BatchLoopDeps): Promise<number> {
  let lastExitCode = 0;
  for (;;) {
    const payload = await deps.nextBegin();
    if (!payload || payload.files.length === 0) return lastExitCode;
    lastExitCode = await deps.runBatch(payload);
    deps.showSummary();
    const choice = await deps.nextChoice();
    if (choice !== "again") return lastExitCode;
  }
}
