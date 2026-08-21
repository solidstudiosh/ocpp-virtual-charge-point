import { createTestRenderer } from "@opentui/core/testing";
import type { Factory, View } from "./view";

export interface ViewHarness<P> {
  view: View<P>;
  /** Settle the renderer and return the rendered char grid. */
  frame(): Promise<string>;
  /** Send a keypress by ParsedKey name, e.g. "p", "up", "return". */
  press(key: string): Promise<void>;
  destroy(): void;
}

/**
 * Mount one view in an in-memory renderer for assertions.
 *
 * Synchronisation is deterministic via `waitForVisualIdle` — never sleep in a
 * test. The Ink suite's `setTimeout(10)` flush hack is not needed here and
 * must not be reintroduced.
 */
export async function renderView<P>(
  factory: Factory<P>,
  initial: P,
  size: { width: number; height: number },
): Promise<ViewHarness<P>> {
  const t = await createTestRenderer(size);
  const view = factory(t.renderer, initial);
  t.renderer.root.add(view.root);

  const frame = async () => {
    await t.waitForVisualIdle();
    await t.renderOnce();
    return t.captureCharFrame();
  };

  return {
    view,
    frame,
    press: async (key: string) => {
      t.mockInput.pressKey(key);
      await t.waitForVisualIdle();
    },
    destroy: () => view.destroy(),
  };
}
