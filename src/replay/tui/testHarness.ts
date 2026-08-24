import { createTestRenderer } from "@opentui/core/testing";
import type { RenderContext } from "@opentui/core";
import type { View } from "./view";

export interface ViewHarness<P, V extends View<P> = View<P>> {
  view: V;
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
 *
 * The view type `V` is threaded through from `factory`'s return type rather
 * than erased to the base `View<P>`, so callers get the concrete screen
 * interface (e.g. `SelectScreenView`) back on `h.view` — without it, every
 * screen-specific method (`values()`, `canAccept()`, `selection()`, ...)
 * would be a type error, caught only by vitest's runtime transpile, not by
 * `tsc`.
 */
export async function renderView<P, V extends View<P> = View<P>>(
  factory: (ctx: RenderContext, initial: P) => V,
  initial: P,
  size: { width: number; height: number },
): Promise<ViewHarness<P, V>> {
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
