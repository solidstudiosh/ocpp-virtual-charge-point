import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { basename } from "node:path";
import { fmtDuration } from "../format";
import { HELP_DETAILS, helpLine } from "../keymap";
import { fitText } from "../layout";
import type { TuiState } from "../state";
import { ATTR_BOLD, color, icon } from "../theme";
import type { View } from "../view";
import { createFrame, createRule } from "../widgets/frame";
import { createFileDots, type FileStatus } from "../widgets/fileQueue";
import { createLogTail } from "../widgets/logTail";
import { createProgressStrip } from "../widgets/progressStrip";
import { createSessionList } from "../widgets/sessionList";

/** Below this inner width the body stacks vertically instead of two columns. */
const NARROW_COLS = 56;

export interface RunScreenProps {
  state: TuiState;
  files: FileStatus[];
  currentIndex: number;
  width: number;
  height: number;
  elapsedMs: number;
  paused: boolean;
  fileLogEnabled: boolean;
  showHelp: boolean;
}

function actionLabel(state: TuiState): string {
  if (state.phase === "running") {
    return `${icon.send} ${state.currentAction ?? "working"}`;
  }
  if (state.phase === "aborting") return "aborting";
  if (state.phase === "complete") return "complete";
  return "idle";
}

export function createRunScreen(
  ctx: RenderContext,
  initial: RunScreenProps,
): View<RunScreenProps> {
  const frame = createFrame(ctx, { title: "", right: "" });
  const dots = createFileDots(ctx, { files: initial.files, currentIndex: 0 });
  const strip = createProgressStrip(ctx, {
    state: initial.state,
    width: initial.width,
  });

  const columns = new BoxRenderable(ctx, {
    id: "run-columns",
    flexDirection: "row",
    flexGrow: 1,
  });
  const leftCol = new BoxRenderable(ctx, {
    id: "run-left",
    flexDirection: "column",
    paddingRight: 1,
  });
  const rightCol = new BoxRenderable(ctx, {
    id: "run-right",
    flexDirection: "column",
    flexGrow: 1,
    paddingLeft: 1,
  });

  const tally = new TextRenderable(ctx, { id: "run-tally" });
  const sessions = createSessionList(ctx, {
    sessions: initial.state.sessions,
    rows: 8,
  });
  const logLabel = new TextRenderable(ctx, {
    id: "run-log-label",
    content: "LOG",
    attributes: ATTR_BOLD,
    fg: color.text,
  });
  const logs = createLogTail(ctx, { logs: initial.state.logs, height: 8 });

  leftCol.add(tally);
  leftCol.add(sessions.root);
  rightCol.add(logLabel);
  rightCol.add(logs.root);
  columns.add(leftCol);
  columns.add(rightCol);

  const helpBlock = new BoxRenderable(ctx, {
    id: "run-help",
    flexDirection: "column",
  });
  for (const [i, line] of HELP_DETAILS.entries()) {
    helpBlock.add(
      new TextRenderable(ctx, {
        id: `run-help-${i}`,
        content: line,
        fg: color.dim,
        wrapMode: "none",
        truncate: true,
      }),
    );
  }

  const statusRow = new BoxRenderable(ctx, {
    id: "run-status",
    flexDirection: "row",
  });
  const action = new TextRenderable(ctx, {
    id: "run-action",
    fg: color.accent,
    wrapMode: "none",
  });
  const keys = new TextRenderable(ctx, {
    id: "run-keys",
    fg: color.dim,
    wrapMode: "none",
  });
  const statusSpacer = new BoxRenderable(ctx, {
    id: "run-status-spacer",
    flexGrow: 1,
  });
  const pausedTag = new TextRenderable(ctx, {
    id: "run-paused",
    content: " paused",
    fg: color.warn,
  });
  const recTag = new TextRenderable(ctx, {
    id: "run-rec",
    content: ` ${icon.rec} REC`,
    fg: color.error,
  });
  statusRow.add(action);
  statusRow.add(keys);
  statusRow.add(statusSpacer);
  statusRow.add(pausedTag);
  statusRow.add(recTag);

  frame.body.add(strip.root);
  frame.body.add(createRule(ctx).root);
  frame.body.add(columns);
  frame.body.add(helpBlock);
  frame.body.add(createRule(ctx).root);
  frame.body.add(statusRow);
  // The dots live in the frame's title row, between the title and the
  // elapsed-time clock — attaching to `frame.root` instead would render
  // them as a new row below the body, not inline with the title.
  frame.titleExtra.add(dots.root);

  const update = (p: RunScreenProps) => {
    const fileBase = p.state.file ? basename(p.state.file) : "(loading)";
    const batch =
      p.files.length > 1
        ? ` · file ${p.currentIndex + 1}/${p.files.length}`
        : "";
    frame.update({
      title: `REPLAY  ${p.state.stationId ?? "—"} · ${fileBase}${batch}`,
      right: fmtDuration(p.elapsedMs),
    });
    dots.update({ files: p.files, currentIndex: p.currentIndex });
    strip.update({ state: p.state, width: p.width });

    tally.content = `SESSIONS ${icon.done}${p.state.successfulStarts} ${icon.rejected}${p.state.rejected} ${icon.truncated}${p.state.truncated}`;

    // border(2) + title(1) + strip(1) + rule(1) + rule(1) + status(1)
    // = 7 rows of chrome consumed outside the two-column body.
    const body = Math.max(
      3,
      p.height - 7 - (p.showHelp ? HELP_DETAILS.length : 0),
    );
    const wide = p.width >= NARROW_COLS;
    columns.flexDirection = wide ? "row" : "column";
    leftCol.width = wide
      ? Math.max(24, Math.min(Math.floor(p.width * 0.5), 52))
      : "auto";

    sessions.update({
      sessions: p.state.sessions,
      rows: wide ? body - 1 : Math.max(1, Math.floor((body - 2) / 2)),
    });
    logs.update({
      logs: p.state.logs,
      height: wide
        ? body - 1
        : Math.max(1, body - 2 - Math.floor((body - 2) / 2)),
    });

    helpBlock.visible = p.showHelp;
    // Pre-truncate the tail rather than letting Core's `truncate` elide the
    // middle of an overflowing hint line. Budget: frame chrome (border(2) +
    // padding(2) = 4), minus the action label sharing this row, minus a
    // small reserve for the gap before it.
    const bodyWidth = Math.max(0, p.width - 4);
    const actionText = actionLabel(p.state);
    action.content = fitText(actionText, bodyWidth);
    keys.content = fitText(
      `   ${helpLine("running", { canBegin: false })}`,
      Math.max(0, bodyWidth - actionText.length - 3),
    );
    pausedTag.visible = p.paused;
    recTag.visible = p.fileLogEnabled;
  };

  update(initial);

  return {
    root: frame.root,
    update,
    destroy() {
      dots.destroy();
      strip.destroy();
      sessions.destroy();
      logs.destroy();
      frame.destroy();
    },
  };
}
