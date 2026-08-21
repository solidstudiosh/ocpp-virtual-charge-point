import { describe, expect, it, vi } from "vitest";
import { BINDINGS, createKeyRouter, helpLine } from "../keymap";

describe("keymap", () => {
  it("derives the help line from the binding table", () => {
    const line = helpLine("running", { canBegin: false });
    expect(line).toContain("[s] stop-now");
    expect(line).toContain("[p] pause");
    expect(line).toContain("[?] help");
    // A binding from another phase must not leak in.
    expect(line).not.toContain("begin");
  });

  it("hides conditional bindings when unavailable", () => {
    expect(helpLine("selecting", { canBegin: false })).not.toContain("[B]");
    expect(helpLine("selecting", { canBegin: true })).toContain("[B] begin");
  });

  it("every binding has a unique action within its phase", () => {
    const seen = new Set<string>();
    for (const b of BINDINGS) {
      const id = `${b.phase}:${b.action}`;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it("never binds the same key twice within a phase", () => {
    const seen = new Set<string>();
    for (const b of BINDINGS) {
      for (const k of b.keys) {
        const id = `${b.phase}:${k}`;
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });

  it("dispatches the action for a pressed key in the active phase", () => {
    const onAction = vi.fn();
    const router = createKeyRouter({
      getPhase: () => "running",
      getContext: () => ({ canBegin: false }),
      onAction,
    });

    router.handle({ name: "p" });
    expect(onAction).toHaveBeenCalledWith("pause", { name: "p" });

    // A key bound only in another phase is ignored.
    onAction.mockClear();
    router.handle({ name: "f" });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("passes the key through so multi-key bindings resolve direction", () => {
    const onAction = vi.fn();
    const router = createKeyRouter({
      getPhase: () => "complete",
      getContext: () => ({ canBegin: false }),
      onAction,
    });
    router.handle({ name: "up" });
    router.handle({ name: "down" });
    expect(onAction).toHaveBeenNthCalledWith(1, "scroll", { name: "up" });
    expect(onAction).toHaveBeenNthCalledWith(2, "scroll", { name: "down" });
  });

  it("respects `when` guards at dispatch time, not just in help", () => {
    const onAction = vi.fn();
    const router = createKeyRouter({
      getPhase: () => "selecting",
      getContext: () => ({ canBegin: false }),
      onAction,
    });
    router.handle({ name: "B" });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("dispatches a guarded binding once its guard passes", () => {
    const onAction = vi.fn();
    const router = createKeyRouter({
      getPhase: () => "selecting",
      getContext: () => ({ canBegin: true }),
      onAction,
    });
    router.handle({ name: "B" });
    expect(onAction).toHaveBeenCalledWith("begin", { name: "B" });
  });
});
