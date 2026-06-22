import { describe, expect, it } from "vitest";
import {
  type BeginPayload,
  type RoundChoice,
  asyncQueue,
  runBatchLoop,
} from "../batchLoop";

describe("asyncQueue", () => {
  it("delivers pushed values in order, buffering ahead of next()", async () => {
    const q = asyncQueue<number>();
    q.push(1);
    q.push(2);
    expect(await q.next()).toBe(1);
    expect(await q.next()).toBe(2);
  });

  it("resolves a pending next() when a value arrives later", async () => {
    const q = asyncQueue<string>();
    const pending = q.next();
    q.push("late");
    expect(await pending).toBe("late");
  });
});

describe("runBatchLoop", () => {
  it("runs rounds until quit and returns the last round's exit code", async () => {
    const begins = asyncQueue<BeginPayload>();
    const choices = asyncQueue<RoundChoice>();
    begins.push({ files: ["a.json"] });
    choices.push("again");
    begins.push({ files: ["b.json"], idTagOverride: "TAG2" });
    choices.push("quit");

    const ran: BeginPayload[] = [];
    let summaries = 0;
    const exitCode = await runBatchLoop({
      nextBegin: () => begins.next(),
      nextChoice: () => choices.next(),
      showSummary: () => {
        summaries++;
      },
      // Round 1 fails (4), round 2 succeeds (0) — last round wins.
      runBatch: async (p) => {
        ran.push(p);
        return ran.length === 1 ? 4 : 0;
      },
    });

    expect(ran.map((p) => p.files)).toEqual([["a.json"], ["b.json"]]);
    expect(ran[1].idTagOverride).toBe("TAG2");
    expect(summaries).toBe(2);
    expect(exitCode).toBe(0);
  });

  it("a failing last round propagates its exit code", async () => {
    const begins = asyncQueue<BeginPayload>();
    const choices = asyncQueue<RoundChoice>();
    begins.push({ files: ["a.json"] });
    choices.push("quit");
    const exitCode = await runBatchLoop({
      nextBegin: () => begins.next(),
      nextChoice: () => choices.next(),
      showSummary: () => {},
      runBatch: async () => 2,
    });
    expect(exitCode).toBe(2);
  });

  it("undefined begin (ink exited) ends the loop with the prior exit code", async () => {
    const exitCode = await runBatchLoop({
      nextBegin: () => Promise.resolve(undefined),
      nextChoice: () => Promise.resolve(undefined),
      showSummary: () => {},
      runBatch: async () => 1,
    });
    expect(exitCode).toBe(0);
  });

  it("undefined choice (ink exited mid-summary) is treated as quit", async () => {
    const begins = asyncQueue<BeginPayload>();
    begins.push({ files: ["a.json"] });
    let rounds = 0;
    const exitCode = await runBatchLoop({
      nextBegin: () => begins.next(),
      nextChoice: () => Promise.resolve(undefined),
      showSummary: () => {},
      runBatch: async () => {
        rounds++;
        return 3;
      },
    });
    expect(rounds).toBe(1);
    expect(exitCode).toBe(3);
  });
});
