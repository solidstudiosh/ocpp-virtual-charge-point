/**
 * Single source of truth for the replay TUI's visual language: a small
 * semantic palette and an ASCII-safe icon set. Centralising these keeps every
 * screen consistent and makes a palette change a one-line edit.
 *
 * All icons are width-1 glyphs. We deliberately avoid emoji — many terminals
 * render emoji as width-2, which corrupts the column math the responsive frame
 * relies on.
 */

import type { ThemeMode } from "@opentui/core";
import type { SessionStatus } from "./state";

export interface ThemePalette {
  accent: string;
  success: string;
  error: string;
  warn: string;
  dir: string;
  chrome: string;
  dim: string;
  text: string;
}

const DARK: ThemePalette = {
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
};

/** Darkened for light backgrounds; same semantics, same member names. */
const LIGHT: ThemePalette = {
  accent: "#007070",
  success: "#2f7a2f",
  error: "#a32222",
  warn: "#8a6a00",
  dir: "#2a4fa3",
  chrome: "#9a9a9a",
  dim: "#6c6c6c",
  text: "#2a2a2a",
};

/**
 * Live semantic palette. Mutated in place by `applyThemeMode` at startup,
 * before any screen mounts, so widgets can keep reading `color.x` directly.
 *
 * Core has no "inherit the terminal foreground" colour — an unset `fg`
 * renders pure white — so the palette must be chosen explicitly rather than
 * delegated to the terminal the way Ink's `undefined` did.
 */
export const color: ThemePalette = { ...DARK };

export function applyThemeMode(mode: ThemeMode): void {
  Object.assign(color, mode === "light" ? LIGHT : DARK);
}

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
