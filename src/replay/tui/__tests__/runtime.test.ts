import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { describe, expect, it } from "vitest";

describe("opentui runtime", () => {
  it("renders a frame under Node with --experimental-ffi", async () => {
    const { renderer, renderOnce, captureCharFrame, waitForVisualIdle } =
      await createTestRenderer({ width: 24, height: 3 });
    const box = new BoxRenderable(renderer, {
      id: "smoke",
      width: 24,
      height: 3,
      border: true,
    });
    renderer.root.add(box);
    box.add(new TextRenderable(renderer, { id: "t", content: "ok" }));
    await waitForVisualIdle();
    await renderOnce();
    expect(captureCharFrame()).toContain("ok");
  });
});
