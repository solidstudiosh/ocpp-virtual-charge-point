import { TextRenderable, type RenderContext } from "@opentui/core";
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import type { View } from "../view";

function createLabel(
  ctx: RenderContext,
  initial: { text: string },
): View<{
  text: string;
}> {
  const root = new TextRenderable(ctx, {
    id: "label",
    content: initial.text,
  });
  return {
    root,
    update(props) {
      root.content = props.text;
    },
    destroy() {
      root.destroy();
    },
  };
}

describe("View contract", () => {
  it("renders initial props and re-renders on update", async () => {
    const h = await renderView(
      createLabel,
      { text: "first" },
      {
        width: 20,
        height: 2,
      },
    );
    expect(await h.frame()).toContain("first");

    h.view.update({ text: "second" });
    const after = await h.frame();
    expect(after).toContain("second");
    expect(after).not.toContain("first");

    h.destroy();
  });
});
