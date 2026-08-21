import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { AuthSource } from "../../connection";
import { color, icon } from "../theme";
import type { View } from "../view";

export interface FileStatus {
  path: string;
  status: "pending" | "running" | "done" | "failed";
  succeeded?: number;
  rejected?: number;
  /** Resolved OCPP id for this file; shown instead of the path when known. */
  cpId?: string;
  /** Where this file's basic-auth password comes from; drives the badge. */
  authSource?: AuthSource;
}

/** Masked auth indicator — never reveals the password value. */
function authBadge(source?: AuthSource): string {
  switch (source) {
    case "file":
      return "  auth ✓";
    case "cli":
      return "  (cli)";
    case "env":
      return "  (env)";
    default:
      return "";
  }
}

const statusIcon = (s: FileStatus["status"]) =>
  s === "done"
    ? icon.done
    : s === "failed"
      ? icon.rejected
      : s === "running"
        ? icon.running
        : icon.pending;

const statusColor = (s: FileStatus["status"], isCurrent: boolean) =>
  isCurrent
    ? color.accent
    : s === "done"
      ? color.success
      : s === "failed"
        ? color.error
        : s === "running"
          ? color.accent
          : color.text;

export function formatFileRow(f: FileStatus): string {
  const tally =
    f.status === "done" || f.status === "failed"
      ? `  ${icon.done}${f.succeeded ?? 0} ${icon.rejected}${f.rejected ?? 0}`
      : "";
  return `${statusIcon(f.status)} ${f.cpId ?? f.path}${authBadge(f.authSource)}${tally}`;
}

export interface FileQueueProps {
  files: FileStatus[];
  currentIndex: number;
  rows: number;
}

/** Vertical batch file list, windowed around the current file. */
export function createFileQueue(
  ctx: RenderContext,
  initial: FileQueueProps,
): View<FileQueueProps> {
  const root = new BoxRenderable(ctx, {
    id: "filequeue",
    flexDirection: "column",
  });
  const pool: TextRenderable[] = [];

  const update = (p: FileQueueProps) => {
    let start = 0;
    if (p.files.length > p.rows) {
      const anchor = p.currentIndex >= 0 ? p.currentIndex : 0;
      start = Math.min(
        Math.max(0, anchor - Math.floor(p.rows / 2)),
        p.files.length - p.rows,
      );
    }
    for (let i = 0; i < p.rows; i++) {
      let r = pool[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `file-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = r;
        root.add(r);
      }
      const f = p.files[start + i];
      if (f === undefined) {
        r.visible = false;
        continue;
      }
      r.visible = true;
      r.content = formatFileRow(f);
      r.fg = statusColor(f.status, start + i === p.currentIndex);
    }
    // The row budget shrinks when the terminal does. Hide pooled rows beyond
    // it, or the previous, taller layout's rows linger on screen.
    for (let i = p.rows; i < pool.length; i++) pool[i].visible = false;
  };

  update(initial);
  return { root, update, destroy: () => root.destroyRecursively() };
}

export interface FileDotsProps {
  files: FileStatus[];
  currentIndex: number;
}

/**
 * Compact one-line batch indicator (`✓✓▶··`) for the running header. Hidden
 * for single-file batches, matching the Ink behaviour.
 */
export function createFileDots(
  ctx: RenderContext,
  initial: FileDotsProps,
): View<FileDotsProps> {
  const root = new BoxRenderable(ctx, { id: "filedots", flexDirection: "row" });
  const pool: TextRenderable[] = [];

  const update = (p: FileDotsProps) => {
    root.visible = p.files.length > 1;
    for (let i = 0; i < p.files.length; i++) {
      let d = pool[i];
      if (d === undefined) {
        d = new TextRenderable(ctx, { id: `dot-${i}` });
        pool[i] = d;
        root.add(d);
      }
      d.visible = true;
      d.content = statusIcon(p.files[i].status);
      d.fg = statusColor(p.files[i].status, i === p.currentIndex);
    }
    for (let i = p.files.length; i < pool.length; i++) pool[i].visible = false;
  };

  update(initial);
  return { root, update, destroy: () => root.destroyRecursively() };
}
