import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { color } from "../theme";
import type { View } from "../view";

export interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  /** Width of the glyph run. 0 hides the bar, leaving percent and counts. */
  barWidth: number;
  fg: string;
}

/** Compact single-line indicator: `label ███░░  60% 3/5`. */
export function createProgressBar(
  ctx: RenderContext,
  initial: ProgressBarProps,
): View<ProgressBarProps> {
  const root = new BoxRenderable(ctx, {
    id: `bar-${initial.label}`,
    flexDirection: "row",
  });
  const label = new TextRenderable(ctx, { id: "label", fg: color.dim });
  const filled = new TextRenderable(ctx, { id: "filled" });
  const empty = new TextRenderable(ctx, { id: "empty", fg: color.dim });
  const pct = new TextRenderable(ctx, { id: "pct", fg: color.text });
  const counts = new TextRenderable(ctx, { id: "counts", fg: color.dim });
  for (const r of [label, filled, empty, pct, counts]) root.add(r);

  const update = (p: ProgressBarProps) => {
    const ratio =
      p.total > 0 ? Math.max(0, Math.min(1, p.current / p.total)) : 0;
    const on = Math.round(ratio * p.barWidth);
    label.content = `${p.label} `;
    filled.content = "█".repeat(on);
    filled.fg = p.fg;
    empty.content = "░".repeat(Math.max(0, p.barWidth - on));
    filled.visible = p.barWidth > 0;
    empty.visible = p.barWidth > 0;
    pct.content = `${(ratio * 100).toFixed(0).padStart(3, " ")}%`;
    counts.content = ` ${p.current}/${p.total}`;
  };

  update(initial);
  return { root, update, destroy: () => root.destroyRecursively() };
}
