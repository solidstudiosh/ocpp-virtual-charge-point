import { ScrollBoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { fmtDuration } from "../format";
import { helpLine } from "../keymap";
import type { FileResult } from "../state";
import { buildSummaryLines } from "../summaryLines";
import { ATTR_BOLD, color } from "../theme";
import type { View } from "../view";
import type { FileStatus } from "../widgets/fileQueue";
import { createFrame, createRule } from "../widgets/frame";

export interface SummaryScreenProps {
  fileResults: FileResult[];
  files: FileStatus[];
  width: number;
  height: number;
}

export interface SummaryScreenView extends View<SummaryScreenProps> {
  scroll(delta: number): void;
  scrollPage(delta: number): void;
}

/**
 * Post-run breakdown. A ScrollBox owns the scrolling, so the manual scroll
 * offset, clamping and blank-padding arithmetic in the Ink version are gone.
 */
export function createSummaryScreen(
  ctx: RenderContext,
  initial: SummaryScreenProps,
): SummaryScreenView {
  const frame = createFrame(ctx, { title: "", right: "" });
  const banner = new TextRenderable(ctx, {
    id: "summary-banner",
    attributes: ATTR_BOLD,
    wrapMode: "none",
    truncate: true,
  });
  const list = new ScrollBoxRenderable(ctx, {
    id: "summary-list",
    scrollY: true,
    viewportCulling: true,
    flexGrow: 1,
  });
  const help = new TextRenderable(ctx, {
    id: "summary-help",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });

  frame.body.add(banner);
  frame.body.add(createRule(ctx).root);
  frame.body.add(list);
  frame.body.add(createRule(ctx).root);
  frame.body.add(help);

  const pool: TextRenderable[] = [];
  let pageRows = 1;

  const update = (p: SummaryScreenProps) => {
    const lines = buildSummaryLines(p.fileResults);
    const totals = p.fileResults.reduce(
      (acc, r) => {
        for (const s of r.sessions) {
          if (s.status === "done") acc.done++;
          else if (s.status === "rejected") acc.rejected++;
          else if (s.status === "truncated") acc.truncated++;
        }
        acc.exitCode = Math.max(acc.exitCode, r.summary?.exitCode ?? 0);
        acc.durationMs += r.summary?.durationMs ?? 0;
        return acc;
      },
      { done: 0, rejected: 0, truncated: 0, exitCode: 0, durationMs: 0 },
    );
    const filesDone = p.files.filter((f) => f.status === "done").length;
    const filesFailed = p.files.filter((f) => f.status === "failed").length;
    const ok = totals.exitCode === 0;

    frame.update({
      title: "COMPLETE",
      right: fmtDuration(totals.durationMs),
    });
    banner.content = `${ok ? "PASS" : "FAIL"}  files ${filesDone} ok, ${filesFailed} failed · sessions ${totals.done} done, ${totals.rejected} rejected, ${totals.truncated} truncated`;
    banner.fg = ok ? color.success : color.error;

    for (let i = 0; i < lines.length; i++) {
      let r = pool[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `summary-line-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = r;
        list.add(r);
      }
      r.visible = true;
      r.content = lines[i].text;
      r.fg = lines[i].color ?? color.text;
      r.attributes = lines[i].bold === true ? ATTR_BOLD : 0;
    }
    for (let i = lines.length; i < pool.length; i++) pool[i].visible = false;

    // border(2) + title(1) + banner(1) + rule(1) + rule(1) + help(1) = 7.
    pageRows = Math.max(1, p.height - 7);
    help.content = helpLine("complete", { canBegin: false });
  };

  update(initial);

  return {
    root: frame.root,
    update,
    scroll(delta) {
      list.scrollTop = Math.max(0, list.scrollTop + delta);
    },
    scrollPage(delta) {
      list.scrollTop = Math.max(0, list.scrollTop + delta * pageRows);
    },
    destroy() {
      frame.destroy();
    },
  };
}
