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

  it("dispatches the action for a pressed key in the active phase", () => {
    const onAction = vi.fn();
    const router = createKeyRouter({
      getPhase: () => "running",
      getContext: () => ({ canBegin: false }),
      onAction,
    });

    router.handle({ name: "p" });
    expect(onAction).toHaveBeenCalledWith("pause");

    // A key bound only in another phase is ignored.
    onAction.mockClear();
    router.handle({ name: "f" });
    expect(onAction).not.toHaveBeenCalled();
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
});
