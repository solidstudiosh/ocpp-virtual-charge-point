import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { ATTR_BOLD, color } from "../theme";
import type { View } from "../view";

export interface FrameProps {
  /** Left-hand title content. */
  title: string;
  /** Right-aligned content on the title row, e.g. an elapsed clock. */
  right: string;
}

export interface FrameView extends View<FrameProps> {
  /** Attach screen content here, not to `root`. */
  readonly body: BoxRenderable;
  /**
   * Extra title-row content, between the title and the right-aligned
   * clock — e.g. a batch progress indicator. Attach here, not to `root`:
   * `root`'s only children are the title row and the body, so anything
   * added directly to `root` renders as a new row below the body rather
   * than inline with the title.
   */
  readonly titleExtra: BoxRenderable;
}

/**
 * The single outer frame shared by every screen: a border with a title row
 * (left content, optional extra content, then right-aligned content) above
 * a content body.
 *
 * Unlike the Ink version this takes no explicit width/height. Core measures
 * and clips, so the fixed-size arithmetic that upheld Ink's no-flicker
 * invariant is gone.
 */
export function createFrame(
  ctx: RenderContext,
  initial: FrameProps,
): FrameView {
  const root = new BoxRenderable(ctx, {
    id: "frame",
    border: true,
    borderColor: color.chrome,
    paddingLeft: 1,
    paddingRight: 1,
    flexDirection: "column",
    flexGrow: 1,
  });

  const titleRow = new BoxRenderable(ctx, {
    id: "frame-title-row",
    flexDirection: "row",
  });
  const title = new TextRenderable(ctx, {
    id: "frame-title",
    fg: color.accent,
    attributes: ATTR_BOLD,
    wrapMode: "none",
    truncate: true,
  });
  const spacer = new BoxRenderable(ctx, { id: "frame-spacer", flexGrow: 1 });
  const titleExtra = new BoxRenderable(ctx, {
    id: "frame-title-extra",
    flexDirection: "row",
  });
  const right = new TextRenderable(ctx, {
    id: "frame-right",
    fg: color.dim,
    wrapMode: "none",
    // Keep title-row extras (e.g. file dots) off the clock; without this the
    // two run together as `✓▶·1m5.0s`.
    marginLeft: 2,
  });
  titleRow.add(title);
  titleRow.add(spacer);
  titleRow.add(titleExtra);
  titleRow.add(right);

  const body = new BoxRenderable(ctx, {
    id: "frame-body",
    flexDirection: "column",
    flexGrow: 1,
  });

  root.add(titleRow);
  root.add(body);

  const update = (p: FrameProps) => {
    title.content = p.title;
    right.content = p.right;
  };
  update(initial);

  return {
    root,
    body,
    titleExtra,
    update,
    destroy: () => root.destroyRecursively(),
  };
}

/** A single-row horizontal divider, dimmed to read as chrome. */
export function createRule(ctx: RenderContext): View<Record<string, never>> {
  const root = new TextRenderable(ctx, {
    id: `rule-${ruleCounter++}`,
    content: "─".repeat(200),
    fg: color.chrome,
    wrapMode: "none",
    truncate: true,
  });
  return { root, update: () => {}, destroy: () => root.destroyRecursively() };
}

let ruleCounter = 0;
