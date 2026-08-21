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

/** Semantic palette. Hex strings; Core parses them to RGBA. */
export const color = {
  /** Active / in-flight / cursor. */
  accent: "#00d7d7",
  success: "#5faf5f",
  error: "#d75f5f",
  /** Truncated, paused, and other "attention" states. */
  warn: "#d7af5f",
  /** Directories in the file browser. */
  dir: "#5f87d7",
  /** Frame borders and chrome. */
  chrome: "#6c6c6c",
  /** Secondary/de-emphasised text. Replaces Ink's `dimColor`. */
  dim: "#8a8a8a",
  /** Default body text. */
  text: "#d0d0d0",
} as const;

/** Core text attribute bitmask for bold. Replaces Ink's `bold` prop. */
export const ATTR_BOLD = 1;

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

export function sessionColor(status: SessionStatus): string {
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
      return color.text;
  }
}

/** Colour for a log line based on its level. */
export function levelColor(level: string): string {
  if (level === "error") return color.error;
  if (level === "warn") return color.warn;
  return color.text;
}
