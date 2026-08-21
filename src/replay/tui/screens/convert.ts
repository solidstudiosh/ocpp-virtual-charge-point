import { BoxRenderable, InputRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { helpLine } from "../keymap";
import { ATTR_BOLD, color } from "../theme";
import type { View } from "../view";
import { createFrame, createRule } from "../widgets/frame";

export interface ConvertFormValues {
  stationId: string;
  password: string;
  rebaseTimestamps: boolean;
}

export interface ConvertWizardStats {
  calls: number;
  sessions: number;
  dropped: number;
  corrupt: number;
}

const FIELD_ROWS = ["stationId", "password", "timestamps"] as const;

export interface ConvertScreenProps {
  /** Basename of the source file, for the heading. */
  fileLabel: string;
  /** 0-based position in the wizard queue. */
  index: number;
  total: number;
  initialStationId: string;
  /** Parse summary; undefined when the file failed to parse. */
  stats?: ConvertWizardStats;
  /** When set, the form is read-only: accept skips (drops the file). */
  error?: string;
  width: number;
  height: number;
}

export interface ConvertScreenView extends View<ConvertScreenProps> {
  field(delta: number): void;
  values(): ConvertFormValues;
  isErrorMode(): boolean;
  canAccept(): boolean;
  toggleRebase(): void;
  /**
   * Index of the focused field row (0-2).
   *
   * Focus is signalled only by colour and the bold attribute, which
   * `captureCharFrame()` strips — so without this accessor `field()`'s
   * clamping is unobservable and therefore untestable.
   */
  focusedRow(): number;
}

export function createConvertScreen(
  ctx: RenderContext,
  initial: ConvertScreenProps,
): ConvertScreenView {
  let row = 0;
  let rebase = true;
  let latest = initial;

  const frame = createFrame(ctx, { title: "", right: "" });
  const stats = new TextRenderable(ctx, {
    id: "convert-stats",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });
  const errorLine = new TextRenderable(ctx, {
    id: "convert-error",
    fg: color.error,
    wrapMode: "none",
    truncate: true,
  });

  const mkRow = (id: string, label: string) => {
    const box = new BoxRenderable(ctx, {
      id: `${id}-row`,
      flexDirection: "row",
    });
    const lbl = new TextRenderable(ctx, {
      id: `${id}-label`,
      content: label.padEnd(12),
      fg: color.dim,
    });
    box.add(lbl);
    return { box, lbl };
  };

  const stationRow = mkRow("station", "stationId");
  const stationInput = new InputRenderable(ctx, {
    id: "station-input",
    value: initial.initialStationId,
  });
  stationRow.box.add(stationInput);

  const passwordRow = mkRow("password", "password");
  const passwordInput = new InputRenderable(ctx, {
    id: "password-input",
    value: "",
  });
  passwordRow.box.add(passwordInput);

  const rebaseRow = mkRow("rebase", "timestamps");
  const rebaseValue = new TextRenderable(ctx, { id: "rebase-value" });
  rebaseRow.box.add(rebaseValue);

  const help = new TextRenderable(ctx, {
    id: "convert-help",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });

  frame.body.add(stats);
  frame.body.add(errorLine);
  frame.body.add(createRule(ctx).root);
  frame.body.add(stationRow.box);
  frame.body.add(passwordRow.box);
  frame.body.add(rebaseRow.box);
  frame.body.add(createRule(ctx).root);
  frame.body.add(help);

  const errorMode = () => latest.error !== undefined;

  const render = () => {
    frame.update({
      title: `CONVERT  ${latest.fileLabel}`,
      right: `${latest.index + 1}/${latest.total}`,
    });

    stats.visible = latest.stats !== undefined;
    if (latest.stats !== undefined) {
      const s = latest.stats;
      stats.content = `calls ${s.calls} · sessions ${s.sessions} · dropped ${s.dropped} · corrupt ${s.corrupt}`;
    }
    errorLine.visible = errorMode();
    errorLine.content = latest.error ?? "";

    // Read-only while in error mode: the only action is skip.
    stationInput.visible = !errorMode();
    passwordInput.visible = !errorMode();

    const focus = (i: number) =>
      !errorMode() && row === i ? color.accent : color.dim;
    stationRow.lbl.fg = focus(0);
    passwordRow.lbl.fg = focus(1);
    rebaseRow.lbl.fg = focus(2);
    rebaseValue.content = rebase ? "rebase to now" : "keep original";
    rebaseValue.fg = row === 2 && !errorMode() ? color.accent : color.text;
    rebaseValue.attributes = row === 2 ? ATTR_BOLD : 0;

    // Normal mode derives from the keymap table, so adding a `converting`
    // binding updates this line automatically. Error mode cannot: it
    // re-purposes Enter as "skip", which the table has no way to express.
    help.content = errorMode()
      ? "[Enter] skip  [Esc] cancel"
      : helpLine("converting", { canBegin: false });
  };

  const update = (p: ConvertScreenProps) => {
    const fileChanged = p.fileLabel !== latest.fileLabel;
    latest = p;
    if (fileChanged) {
      // A new file in the queue resets the form.
      row = 0;
      rebase = true;
      stationInput.value = p.initialStationId;
      passwordInput.value = "";
    }
    render();
  };

  update(initial);

  return {
    root: frame.root,
    update,
    field(delta) {
      if (errorMode()) return;
      row = Math.max(0, Math.min(FIELD_ROWS.length - 1, row + delta));
      render();
    },
    toggleRebase() {
      if (errorMode()) return;
      rebase = !rebase;
      render();
    },
    values: () => ({
      stationId: stationInput.value.trim(),
      password: passwordInput.value,
      rebaseTimestamps: rebase,
    }),
    isErrorMode: errorMode,
    canAccept: () => !errorMode() && stationInput.value.trim().length > 0,
    focusedRow: () => row,
    destroy() {
      frame.destroy();
    },
  };
}
