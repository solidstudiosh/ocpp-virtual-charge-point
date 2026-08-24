/**
 * Text-fitting helpers for the replay TUI.
 *
 * Under Ink, this file also owned terminal-size tracking: the UI rendered
 * *exactly* `terminal.rows` lines every frame so Ink could perform in-place
 * cursor updates instead of clearing and redrawing the screen, which is what
 * kept the UI flicker-free as live replay data flooded in. `@opentui/core`
 * owns layout and resize (`renderer.width`/`renderer.height`, the `resize`
 * event) natively, so that invariant — and the size-tracking hook that
 * served it — no longer applies here. `fitText` remains: it's still used to
 * truncate strings composed before render (e.g. summary lines).
 */

import cliTruncate from "cli-truncate";
import stringWidth from "string-width";

/** Fallbacks for non-TTY environments (piped output, tests). */
export const FALLBACK_COLS = 80;
export const FALLBACK_ROWS = 24;

/**
 * Truncate `s` to fit `width` columns, accounting for multi-byte / wide glyphs
 * via string-width. Returns the string unchanged when it already fits or when
 * width is non-positive (the latter only happens in degenerate layouts).
 */
export function fitText(s: string, width: number): string {
  if (width <= 0) return "";
  if (stringWidth(s) <= width) return s;
  return cliTruncate(s, width, { position: "end" });
}
