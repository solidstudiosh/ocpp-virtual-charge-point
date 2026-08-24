import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { helpLine } from "../keymap";
import { fitText } from "../layout";
import { ATTR_BOLD, color, icon } from "../theme";
import type { View } from "../view";
import { createFrame, createRule } from "../widgets/frame";
import { createFileQueue, type FileStatus } from "../widgets/fileQueue";
import { createIdTagField } from "../widgets/idTagField";

interface Entry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface SelectScreenProps {
  cwd: string;
  selected: string[];
  fileStatusFor: (path: string) => FileStatus;
  idTag: string;
  editingIdTag: boolean;
  width: number;
  height: number;
}

export interface SelectScreenView extends View<SelectScreenProps> {
  move(delta: number): void;
  page(delta: number): void;
  /** Enter the directory under the cursor, or toggle a file. */
  open(): void;
  toggle(): void;
  up(): void;
  selectAll(): void;
  clear(): void;
  selection(): string[];
  idTagValue(): string;
  /**
   * The directory currently browsed. The screen owns this once mounted —
   * `update()` never resets it from props — so `app.ts` reads it back here
   * to carry the browsed directory across a destroy+recreate (e.g. the
   * convert flow, or "another round") instead of resetting to the launch
   * cwd.
   */
  cwd(): string;
}

function readEntries(dir: string): Entry[] {
  const out: Entry[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    // Directory vanished or is unreadable mid-session; show it as empty
    // rather than tearing the TUI down.
    return out;
  }
  for (const name of names.sort()) {
    const path = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(path).isDirectory();
    } catch {
      continue;
    }
    if (isDir || name.toLowerCase().endsWith(".json")) {
      out.push({ name, path, isDir });
    }
  }
  // Directories first, then files — matching the Ink browser's ordering.
  return out.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
  );
}

export function createSelectScreen(
  ctx: RenderContext,
  initial: SelectScreenProps,
): SelectScreenView {
  let cwd = initial.cwd;
  let entries = readEntries(cwd);
  let cursor = 0;
  const selected = new Set<string>(initial.selected);
  let latest = initial;

  const frame = createFrame(ctx, { title: "", right: "" });
  const idTag = createIdTagField(ctx, {
    value: initial.idTag,
    editing: initial.editingIdTag,
  });

  const columns = new BoxRenderable(ctx, {
    id: "select-cols",
    flexDirection: "row",
    flexGrow: 1,
  });
  const leftCol = new BoxRenderable(ctx, {
    id: "select-left",
    flexDirection: "column",
    paddingRight: 1,
  });
  const rightCol = new BoxRenderable(ctx, {
    id: "select-right",
    flexDirection: "column",
    flexGrow: 1,
    paddingLeft: 1,
  });
  const selectedLabel = new TextRenderable(ctx, {
    id: "select-right-label",
    content: "SELECTED",
    attributes: ATTR_BOLD,
    fg: color.text,
  });
  const queue = createFileQueue(ctx, {
    files: [],
    currentIndex: -1,
    rows: 10,
  });
  rightCol.add(selectedLabel);
  rightCol.add(queue.root);
  columns.add(leftCol);
  columns.add(rightCol);

  const rows: TextRenderable[] = [];
  const help = new TextRenderable(ctx, {
    id: "select-help",
    fg: color.dim,
    wrapMode: "none",
  });

  frame.body.add(idTag.root);
  frame.body.add(createRule(ctx).root);
  frame.body.add(columns);
  frame.body.add(createRule(ctx).root);
  frame.body.add(help);

  /** `..` occupies row 0 unless we are at the filesystem root. */
  const showParent = () => dirname(cwd) !== cwd;
  const total = () => entries.length + (showParent() ? 1 : 0);
  const entryAt = (i: number): Entry | undefined =>
    showParent() ? entries[i - 1] : entries[i];

  const render = () => {
    // border(2) + title(1) + idTag(1) + rule(1) + rule(1) + help(1) = 7.
    const listRows = Math.max(3, latest.height - 7);
    const start = Math.min(
      Math.max(0, cursor - Math.floor(listRows / 2)),
      Math.max(0, total() - listRows),
    );

    for (let i = 0; i < listRows; i++) {
      let r = rows[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `select-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        rows[i] = r;
        leftCol.add(r);
      }
      const idx = start + i;
      if (idx >= total()) {
        r.visible = false;
        continue;
      }
      r.visible = true;
      const isCursor = idx === cursor;
      const marker = isCursor ? icon.cursor : " ";
      if (showParent() && idx === 0) {
        r.content = `${marker} ..`;
        r.fg = isCursor ? color.accent : color.dir;
        continue;
      }
      const e = entryAt(idx);
      if (e === undefined) {
        r.visible = false;
        continue;
      }
      const mark = selected.has(e.path) ? icon.done : " ";
      r.content = `${marker}${mark} ${e.isDir ? `${e.name}/` : e.name}`;
      r.fg = isCursor ? color.accent : e.isDir ? color.dir : color.text;
    }
    // The row budget shrinks when the terminal does. Hide pooled rows beyond
    // it, or the previous, taller layout's rows linger on screen (same fix
    // as widgets/fileQueue.ts and widgets/sessionList.ts).
    for (let i = listRows; i < rows.length; i++) rows[i].visible = false;

    const list = Array.from(selected).sort();
    queue.update({
      files: list.map(latest.fileStatusFor),
      currentIndex: -1,
      // As listRows, minus this pane's own SELECTED label row.
      rows: Math.max(3, latest.height - 8),
    });

    frame.update({
      title: `SELECT FILES  ${cwd}`,
      right: `${selected.size} selected`,
    });
    idTag.update({ value: latest.idTag, editing: latest.editingIdTag });
    // Core's `truncate` elides the *middle* of overflowing text, which turns
    // a hint like "[Space] toggle" into an unreadable "[Sp...ar" fragment —
    // and the help bar is the app's only discovery surface. Pre-truncate the
    // tail instead (border(2) + padding(2) = 4 columns of frame chrome).
    help.content = fitText(
      helpLine("selecting", { canBegin: selected.size > 0 }),
      Math.max(0, latest.width - 4),
    );
  };

  const update = (p: SelectScreenProps) => {
    // `p.cwd` is only the *initial* root, honoured at construction. Once
    // mounted, this screen owns the browsed directory — re-syncing from
    // props here would reset the user's navigation on every rerender
    // (resize, the idTag editor, or even a winston log line arriving while
    // browsing a subdirectory).
    latest = p;
    render();
  };

  update(initial);

  return {
    root: frame.root,
    update,
    move(delta) {
      cursor = Math.max(0, Math.min(total() - 1, cursor + delta));
      render();
    },
    page(delta) {
      cursor = Math.max(0, Math.min(total() - 1, cursor + delta * 10));
      render();
    },
    open() {
      if (showParent() && cursor === 0) {
        cwd = dirname(cwd);
        entries = readEntries(cwd);
        cursor = 0;
        render();
        return;
      }
      const e = entryAt(cursor);
      if (e === undefined) return;
      if (e.isDir) {
        cwd = e.path;
        entries = readEntries(cwd);
        cursor = 0;
      } else if (selected.has(e.path)) {
        selected.delete(e.path);
      } else {
        selected.add(e.path);
      }
      render();
    },
    toggle() {
      const e = entryAt(cursor);
      if (e === undefined || e.isDir) return;
      if (selected.has(e.path)) selected.delete(e.path);
      else selected.add(e.path);
      render();
    },
    up() {
      if (!showParent()) return;
      cwd = dirname(cwd);
      entries = readEntries(cwd);
      cursor = 0;
      render();
    },
    selectAll() {
      for (const e of entries) if (!e.isDir) selected.add(e.path);
      render();
    },
    clear() {
      selected.clear();
      render();
    },
    selection: () => Array.from(selected).sort(),
    idTagValue: () => idTag.value(),
    cwd: () => cwd,
    destroy() {
      idTag.destroy();
      queue.destroy();
      frame.destroy();
    },
  };
}
