/**
 * Responsive-layout helpers for the replay TUI.
 *
 * The whole UI is built on one invariant: every screen renders *exactly*
 * `terminal.rows` lines, with panels padded to a fixed height. When the
 * rendered line count never changes between renders, Ink performs in-place
 * cursor updates instead of clearing and redrawing the screen — which is what
 * keeps the UI flicker-free as live replay data floods in. These helpers exist
 * to make that invariant easy to honour.
 */

import cliTruncate from "cli-truncate";
import { useStdout } from "ink";
import { useEffect, useState } from "react";
import stringWidth from "string-width";

/** Fallbacks for non-TTY environments (piped output, tests). */
export const FALLBACK_COLS = 80;
export const FALLBACK_ROWS = 24;

export interface TerminalSize {
  cols: number;
  rows: number;
}

/**
 * Current terminal size, kept in sync with the `resize` event so the layout
 * reflows instead of corrupting when the window changes. `ink-testing-library`
 * exposes `columns` (100) but no `rows`, so rows falls back to FALLBACK_ROWS in
 * tests — large enough for content assertions to pass.
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<TerminalSize>(() => ({
    cols: stdout?.columns ?? FALLBACK_COLS,
    rows: stdout?.rows ?? FALLBACK_ROWS,
  }));

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setSize({
        cols: stdout.columns ?? FALLBACK_COLS,
        rows: stdout.rows ?? FALLBACK_ROWS,
      });
    };
    stdout.on("resize", onResize);
    // Re-read once on mount in case the size changed before we subscribed.
    onResize();
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}

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
