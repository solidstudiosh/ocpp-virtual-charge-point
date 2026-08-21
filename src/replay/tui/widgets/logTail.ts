import { ScrollBoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { LogLine } from "../state";
import { color, levelColor } from "../theme";
import type { View } from "../view";

export interface LogTailProps {
  logs: LogLine[];
  /** Visible height of the scroll viewport, in rows. */
  height: number;
}

/**
 * Scrollable tail of the log buffer.
 *
 * Rows are pooled and reused: appending a log line assigns `.content` on a
 * recycled TextRenderable rather than rebuilding the list. Sticky-bottom
 * scrolling keeps the newest line visible while leaving history reachable —
 * the Ink version could only ever show the last N lines.
 */
export function createLogTail(
  ctx: RenderContext,
  initial: LogTailProps,
): View<LogTailProps> {
  const root = new ScrollBoxRenderable(ctx, {
    id: "logtail",
    height: initial.height,
    stickyScroll: true,
    stickyStart: "bottom",
    scrollY: true,
    viewportCulling: true,
  });

  const placeholder = new TextRenderable(ctx, {
    id: "logtail-empty",
    content: "(no log lines yet)",
    fg: color.dim,
  });
  root.add(placeholder);

  const pool: TextRenderable[] = [];
  let mounted = 0;

  const update = (props: LogTailProps) => {
    root.height = props.height;
    placeholder.visible = props.logs.length === 0;

    for (let i = 0; i < props.logs.length; i++) {
      const l = props.logs[i];
      let row = pool[i];
      if (row === undefined) {
        row = new TextRenderable(ctx, {
          id: `logtail-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = row;
        root.add(row);
      }
      row.content = l.message;
      row.fg = levelColor(l.level);
      row.visible = true;
    }
    // Hide surplus rows from a previous, longer buffer instead of destroying
    // them — the pool is reused on the next update.
    for (let i = props.logs.length; i < mounted; i++) {
      pool[i].visible = false;
    }
    mounted = props.logs.length;
  };

  update(initial);

  return {
    root,
    update,
    destroy() {
      root.destroy();
    },
  };
}
