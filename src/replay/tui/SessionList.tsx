import { Box, Text } from "ink";
import { fitText } from "./layout";
import type { SessionRow } from "./state";
import { sessionColor, sessionIcon } from "./theme";

interface Props {
  sessions: SessionRow[];
  /** Number of content rows to render (windowed + blank-padded to this). */
  rows?: number;
  /** Column width for per-row truncation. */
  width?: number;
}

function formatRow(s: SessionRow): string {
  const head = `${sessionIcon(s.status)} #${s.index.toString().padStart(3, " ")}`;
  const reason =
    s.status === "rejected" && s.reason ? `  reason=${s.reason}` : "";
  return `${head} cid=${s.connectorId ?? "?"} idTag=${s.idTag ?? "?"} tx=${s.txId ?? "?"}${reason}`;
}

/**
 * The live session list, rendered as borderless content for the unified frame.
 * Windows around the running session and pads with blank rows so it always
 * occupies exactly `rows` lines — preserving the constant-height invariant.
 */
export function SessionList({ sessions, rows, width }: Props) {
  const budget = rows ?? sessions.length;
  const running = sessions.findIndex((s) => s.status === "running");

  let start = 0;
  if (sessions.length > budget) {
    start = Math.max(
      0,
      (running >= 0 ? running : sessions.length) - Math.floor(budget / 2),
    );
    start = Math.min(start, sessions.length - budget);
  }
  const slice = sessions.slice(start, start + budget);
  const blanks = Math.max(0, budget - slice.length);

  return (
    <Box flexDirection="column">
      {slice.map((s) => {
        const line = formatRow(s);
        return (
          <Text
            key={s.index}
            color={sessionColor(s.status)}
            wrap="truncate-end"
          >
            {width ? fitText(line, width) : line}
          </Text>
        );
      })}
      {Array.from({ length: blanks }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blank padding rows have no identity beyond position
        <Text key={`blank-${i}`}> </Text>
      ))}
    </Box>
  );
}
