/**
 * Single source of truth for the replay TUI's visual language: a small
 * semantic palette and an ASCII-safe icon set. Centralising these keeps every
 * screen consistent and makes a palette change a one-line edit.
 *
 * All icons are width-1 glyphs. We deliberately avoid emoji — many terminals
 * render emoji as width-2, which corrupts the column math the responsive frame
 * relies on.
 */

import type { SessionStatus } from "./state";

/** Semantic colour names (Ink colour strings). */
export const color = {
  /** Active / in-flight / cursor. */
  accent: "cyan",
  success: "green",
  error: "red",
  /** Truncated, paused, and other "attention" states. */
  warn: "yellow",
  /** Directories in the file browser. */
  dir: "blue",
  /** Frame borders and chrome. */
  chrome: "gray",
} as const;

/** Status glyphs, shared by SessionList, the batch indicator and tallies. */
export const icon = {
  running: "▶",
  done: "✓",
  rejected: "✗",
  truncated: "⊘",
  pending: "·",
  /** Outgoing message marker in the log / status line. */
  send: "▸",
  /** File-log recording indicator. */
  rec: "●",
  /** File-browser selection cursor. */
  cursor: "›",
} as const;

export function sessionIcon(status: SessionStatus): string {
  switch (status) {
    case "done":
      return icon.done;
    case "rejected":
      return icon.rejected;
    case "truncated":
      return icon.truncated;
    case "running":
      return icon.running;
    default:
      return icon.pending;
  }
}

export function sessionColor(status: SessionStatus): string | undefined {
  switch (status) {
    case "done":
      return color.success;
    case "rejected":
      return color.error;
    case "truncated":
      return color.warn;
    case "running":
      return color.accent;
    default:
      return undefined;
  }
}

/** Colour for a log line based on its level. */
export function levelColor(level: string): string | undefined {
  return level === "error"
    ? color.error
    : level === "warn"
      ? color.warn
      : undefined;
}
