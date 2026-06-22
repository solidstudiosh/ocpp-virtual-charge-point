import { Box, Text } from "ink";
import { color as theme } from "./theme";

interface Props {
  label: string;
  value?: number;
  current?: number;
  total?: number;
  /** Width of the bar glyph run. 0 hides the bar (counts/percent only). */
  barWidth?: number;
  color?: string;
}

function ratioOf(
  value: number | undefined,
  current: number | undefined,
  total: number | undefined,
): number {
  if (typeof current === "number" && typeof total === "number") {
    return total > 0 ? current / total : 0;
  }
  return value ?? 0;
}

/**
 * A compact, single-line progress indicator: `label ███░░ 60% 3/5`. Designed
 * to sit several-to-a-row in the progress strip, so it carries no label
 * padding and a caller-controlled bar width.
 */
export function ProgressBar({
  label,
  value,
  current,
  total,
  barWidth = 8,
  color = theme.accent,
}: Props) {
  const hasCounts = typeof current === "number" && typeof total === "number";
  const clamped = Math.max(0, Math.min(1, ratioOf(value, current, total)));
  const filled = Math.round(clamped * barWidth);
  const empty = Math.max(0, barWidth - filled);
  const pct = `${(clamped * 100).toFixed(0).padStart(3, " ")}%`;
  return (
    <Box>
      <Text dimColor>{label} </Text>
      {barWidth > 0 ? (
        <>
          <Text color={color}>{"█".repeat(filled)}</Text>
          <Text dimColor>{"░".repeat(empty)}</Text>
          <Text> </Text>
        </>
      ) : null}
      <Text>{pct}</Text>
      {hasCounts ? (
        <Text dimColor>
          {" "}
          {current}/{total}
        </Text>
      ) : null}
    </Box>
  );
}
