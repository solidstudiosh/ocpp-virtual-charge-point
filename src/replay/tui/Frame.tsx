import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { color } from "./theme";

/** Rows consumed by the frame chrome (top + bottom border). */
export const FRAME_CHROME_ROWS = 2;
/** Columns consumed by the frame chrome (left + right border + paddingX:1). */
export const FRAME_CHROME_COLS = 4;
/** Inner content width available inside the frame. */
export function frameInnerWidth(cols: number): number {
  return Math.max(1, cols - FRAME_CHROME_COLS);
}
/** Inner content height available inside the frame. */
export function frameInnerHeight(rows: number): number {
  return Math.max(1, rows - FRAME_CHROME_ROWS);
}

interface Props {
  width: number;
  height: number;
  /** Left-hand title content. Callers must pre-truncate to fit. */
  title?: ReactNode;
  /** Right-aligned content on the title row (e.g. an elapsed clock). */
  right?: ReactNode;
  children: ReactNode;
}

/**
 * The single outer frame shared by every screen. A rounded, dimmed border with
 * an optional title row (left content + right-aligned content) as the first
 * inner row. Sized explicitly to `width`×`height` so it never relies on its
 * content to size itself — content that would overflow is the caller's
 * responsibility to truncate (see `fitText`). Keeping the frame a fixed size is
 * what upholds the constant-height, no-flicker invariant.
 */
export function Frame({ width, height, title, right, children }: Props) {
  return (
    <Box
      width={width}
      height={height}
      borderStyle="round"
      borderColor={color.chrome}
      paddingX={1}
      flexDirection="column"
    >
      {title !== undefined || right !== undefined ? (
        <Box justifyContent="space-between">
          <Box flexShrink={1}>
            {typeof title === "string" ? (
              <Text wrap="truncate-end">{title}</Text>
            ) : (
              title
            )}
          </Box>
          {right !== undefined ? (
            <Box flexShrink={0} marginLeft={1}>
              {typeof right === "string" ? <Text>{right}</Text> : right}
            </Box>
          ) : null}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
