import { Box, Text, useStdout } from "ink";
import { fitText } from "./layout";
import type { LogLine } from "./state";
import { levelColor } from "./theme";

interface Props {
  logs: LogLine[];
  /** Number of content rows to render (tail + blank-padded to this). */
  rows?: number;
  /** Column width for per-line truncation. Falls back to the terminal width. */
  width?: number;
}

/**
 * Tail of the log buffer, rendered as borderless content for the unified
 * frame. Always occupies exactly `rows` lines (last-N + blank padding) and
 * truncates each line to width, so it never wraps or changes height as logs
 * accumulate.
 */
export function LogTail({ logs, rows = 6, width }: Props) {
  const { stdout } = useStdout();
  const cols = width ?? stdout?.columns ?? 0;
  const maxLineLen = cols > 0 ? Math.max(20, cols) : Number.POSITIVE_INFINITY;

  const visible = logs.slice(-rows);
  const showPlaceholder = logs.length === 0;
  const used = showPlaceholder ? 1 : visible.length;
  const blanks = Math.max(0, rows - used);

  return (
    <Box flexDirection="column">
      {showPlaceholder ? <Text dimColor>(no log lines yet)</Text> : null}
      {visible.map((l) => (
        <Text key={l.id} color={levelColor(l.level)} wrap="truncate-end">
          {Number.isFinite(maxLineLen)
            ? fitText(l.message, maxLineLen)
            : l.message}
        </Text>
      ))}
      {Array.from({ length: blanks }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blank padding rows have no identity beyond position
        <Text key={`blank-${i}`}> </Text>
      ))}
    </Box>
  );
}
