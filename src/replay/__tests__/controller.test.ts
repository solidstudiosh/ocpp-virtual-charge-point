import { describe, expect, it } from "vitest";
import { createReplayController } from "../controller";

describe("ReplayController", () => {
  it("starts in a neutral state", () => {
    const c = createReplayController();
    expect(c.paused).toBe(false);
    expect(c.stopRequested).toBe(false);
    expect(c.abortRequested).toBe(false);
  });

  it("waitWhilePaused resolves immediately when not paused", async () => {
    const c = createReplayController();
    let resolved = false;
    await c.waitWhilePaused().then(() => {
      resolved = true;
    });
    expect(resolved).toBe(true);
  });

  it("waitWhilePaused blocks while paused and resolves on resume", async () => {
    const c = createReplayController();
    c.pause();
    expect(c.paused).toBe(true);
    let resolved = false;
    const p = c.waitWhilePaused().then(() => {
      resolved = true;
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(resolved).toBe(false);
    c.resume();
    expect(c.paused).toBe(false);
    await p;
    expect(resolved).toBe(true);
  });

  it("togglePause flips state", () => {
    const c = createReplayController();
    c.togglePause();
    expect(c.paused).toBe(true);
    c.togglePause();
    expect(c.paused).toBe(false);
  });

  it("waitWhilePaused resolves immediately if stopRequested set while paused", async () => {
    const c = createReplayController();
    c.pause();
    const p = c.waitWhilePaused();
    c.requestStop();
    await p;
    expect(c.stopRequested).toBe(true);
  });

  it("waitWhilePaused resolves immediately if abortRequested set while paused", async () => {
    const c = createReplayController();
    c.pause();
    const p = c.waitWhilePaused();
    c.requestAbort();
    await p;
    expect(c.abortRequested).toBe(true);
  });

  it("consumeStop returns and clears stopRequested once", () => {
    const c = createReplayController();
    c.requestStop();
    expect(c.consumeStop()).toBe(true);
    expect(c.stopRequested).toBe(false);
    expect(c.consumeStop()).toBe(false);
  });

  it("requestAbort sticks (no consume API)", () => {
    const c = createReplayController();
    c.requestAbort();
    expect(c.abortRequested).toBe(true);
    expect(c.abortRequested).toBe(true);
  });

  it("reset clears pause/stop/abort and releases the pause gate", async () => {
    const c = createReplayController();
    c.requestStop();
    c.requestAbort();
    c.pause();
    const gate = c.waitWhilePaused();
    let released = false;
    void gate.then(() => {
      released = true;
    });
    await Promise.resolve(); // flush microtasks
    expect(released).toBe(false); // gate genuinely pending before reset
    c.reset();
    expect(c.paused).toBe(false);
    expect(c.stopRequested).toBe(false);
    expect(c.abortRequested).toBe(false);
    await gate;
    expect(released).toBe(true);
  });
});
