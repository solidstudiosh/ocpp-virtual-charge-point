import { BoxRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { TuiState } from "../state";
import { color } from "../theme";
import type { View } from "../view";
import { createProgressBar } from "./progressBar";

export interface ProgressStripProps {
  state: TuiState;
  /** Inner width available for the strip. */
  width: number;
}

/**
 * Bar width for the available columns. Below the narrow budget the glyphs are
 * dropped entirely so the strip always fits one line.
 */
export function barWidthFor(width: number): number {
  if (width >= 78) return 10;
  if (width >= 60) return 6;
  return 0;
}

/** The three batch/session progress bars compacted onto a single row. */
export function createProgressStrip(
  ctx: RenderContext,
  initial: ProgressStripProps,
): View<ProgressStripProps> {
  const root = new BoxRenderable(ctx, {
    id: "progressstrip",
    flexDirection: "row",
  });
  const bw = barWidthFor(initial.width);

  const sess = createProgressBar(ctx, {
    label: "Sess",
    current: 0,
    total: 0,
    barWidth: bw,
    fg: color.accent,
  });
  const msg = createProgressBar(ctx, {
    label: "Msg",
    current: 0,
    total: 0,
    barWidth: bw,
    fg: color.dir,
  });
  const cur = createProgressBar(ctx, {
    label: "Cur",
    current: 0,
    total: 0,
    barWidth: bw,
    fg: color.success,
  });

  root.add(sess.root);
  root.add(new BoxRenderable(ctx, { id: "strip-gap-1", paddingLeft: 2 }));
  root.add(msg.root);
  root.add(new BoxRenderable(ctx, { id: "strip-gap-2", paddingLeft: 2 }));
  root.add(cur.root);

  const update = (p: ProgressStripProps) => {
    const w = barWidthFor(p.width);
    sess.update({
      label: "Sess",
      barWidth: w,
      fg: color.accent,
      current: p.state.batchSessionsDone,
      total: p.state.batchTotalSessions,
    });
    msg.update({
      label: "Msg",
      barWidth: w,
      fg: color.dir,
      current: p.state.batchMessagesSent,
      total: p.state.batchTotalMessages,
    });
    cur.update({
      label: "Cur",
      barWidth: w,
      fg: color.success,
      current: p.state.currentSessionMessagesSent,
      total: p.state.currentSessionMessagesPlanned ?? 0,
    });
  };

  update(initial);

  return {
    root,
    update,
    destroy() {
      sess.destroy();
      msg.destroy();
      cur.destroy();
      root.destroyRecursively();
    },
  };
}
