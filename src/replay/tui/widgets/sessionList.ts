import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { SessionRow } from "../state";
import { sessionColor, sessionIcon } from "../theme";
import type { View } from "../view";

export interface SessionListProps {
  sessions: SessionRow[];
  /** Visible rows. The window follows the running session. */
  rows: number;
}

export function formatSessionRow(s: SessionRow): string {
  const head = `${sessionIcon(s.status)} #${s.index.toString().padStart(3, " ")}`;
  const reason =
    s.status === "rejected" && s.reason !== undefined
      ? `  reason=${s.reason}`
      : "";
  return `${head} cid=${s.connectorId ?? "?"} idTag=${s.idTag ?? "?"} tx=${s.txId ?? "?"}${reason}`;
}

/**
 * First visible index, centring the running session when the list overflows.
 *
 * With no running session (`runningIndex === -1`) the anchor is `total`, so
 * the window sits at the tail — deliberate: when nothing is in flight the
 * most recent sessions are the interesting ones.
 */
export function windowStart(
  total: number,
  budget: number,
  runningIndex: number,
): number {
  if (total <= budget) return 0;
  const anchor = runningIndex >= 0 ? runningIndex : total;
  return Math.min(Math.max(0, anchor - Math.floor(budget / 2)), total - budget);
}

/**
 * Live session list. Rows are pooled: the window scrolls by reassigning
 * `.content` on a fixed set of renderables rather than rebuilding the list.
 * No blank-row padding — Core sizes the box, so there is no fixed-height
 * invariant to uphold by hand.
 */
export function createSessionList(
  ctx: RenderContext,
  initial: SessionListProps,
): View<SessionListProps> {
  const root = new BoxRenderable(ctx, {
    id: "sessionlist",
    flexDirection: "column",
  });
  const pool: TextRenderable[] = [];

  const update = (props: SessionListProps) => {
    const running = props.sessions.findIndex((s) => s.status === "running");
    const start = windowStart(props.sessions.length, props.rows, running);
    const slice = props.sessions.slice(start, start + props.rows);

    for (let i = 0; i < props.rows; i++) {
      let r = pool[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `session-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = r;
        root.add(r);
      }
      const s = slice[i];
      if (s === undefined) {
        r.visible = false;
        continue;
      }
      r.visible = true;
      r.content = formatSessionRow(s);
      r.fg = sessionColor(s.status);
    }
    // The row budget shrinks when the terminal does. Hide pooled rows beyond
    // it, or the previous, taller layout's rows linger on screen.
    for (let i = props.rows; i < pool.length; i++) pool[i].visible = false;
  };

  update(initial);

  return {
    root,
    update,
    destroy() {
      root.destroyRecursively();
    },
  };
}
