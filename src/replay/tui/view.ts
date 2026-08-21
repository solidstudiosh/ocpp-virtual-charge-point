import type { Renderable, RenderContext } from "@opentui/core";

/**
 * The contract every widget and screen implements.
 *
 * Renderables are constructed exactly once, inside the factory. `update` only
 * assigns to properties — Core dirty-tracks natively, so redundant assignment
 * is cheap and no conditional tree-building is ever needed. This is what keeps
 * imperative UI code from turning into ad-hoc mutation scattered across files.
 */
export interface View<P> {
  readonly root: Renderable;
  /** Idempotent. Assign to properties; never rebuild the tree. */
  update(props: P): void;
  destroy(): void;
}

/** A widget or screen constructor. `ctx` is the renderer. */
export type Factory<P> = (ctx: RenderContext, initial: P) => View<P>;

/**
 * A view whose prop type is not known to the holder — for heterogeneous
 * collections like the ScreenRouter's "currently mounted screen".
 */
// biome-ignore lint/suspicious/noExplicitAny: intentionally prop-type-erased
export type AnyView = View<any>;

/** Attach every view's root to `parent`, in order. */
export function mountAll(parent: Renderable, views: AnyView[]): void {
  for (const v of views) parent.add(v.root);
}

/** Destroy every view, tolerating already-destroyed children. */
export function destroyAll(views: AnyView[]): void {
  for (const v of views) v.destroy();
}
