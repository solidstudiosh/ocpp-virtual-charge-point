import { Box, Text } from "ink";

export type Phase = "selecting" | "ready" | "running" | "complete";

interface Props {
  phase: Phase;
  canBegin?: boolean;
}

export function shortKeys(phase: Phase, canBegin: boolean): string {
  switch (phase) {
    case "selecting":
      return `[↑↓] move  [Enter/Space] toggle  [u] up  [a] all  [c] clear  [v] convert  [t] idTag  ${
        canBegin ? "[B] begin  " : ""
      }[q] quit`;
    case "ready":
      return "[B] begin  [t] idTag  [e] edit  [q] quit";
    case "running":
      return "[s] stop-now  [p] pause  [a] abort  [l] file-log  [?] help";
    case "complete":
      return "[↑↓/PgUp/PgDn] scroll  [f] file selection  [q] quit";
  }
}

/**
 * Keybinding hint line, rendered as borderless content for the unified frame's
 * footer. The expandable per-key help (`?`) is rendered separately by the
 * dashboard so it can claim body space rather than growing the footer.
 */
export function HelpBar({ phase, canBegin = false }: Props) {
  return (
    <Text dimColor wrap="truncate-end">
      {shortKeys(phase, canBegin)}
    </Text>
  );
}

/** Expanded per-key help for the running phase, shown when `?` is toggled. */
export function HelpDetails({ width }: { width: number }) {
  const lines = [
    "s — stop the current session now (synthetic StopTransaction with last MeterValues)",
    "p — pause/resume between messages; the in-flight message completes first",
    "a — abort after truncating the current session; remaining files skipped (exit 4)",
    "l — toggle writing each session's logs under ./data/replay-session-logs",
    "? — toggle this help panel",
  ];
  return (
    <Box flexDirection="column">
      {lines.map((l) => (
        <Text key={l} wrap="truncate-end">
          {width > 0 ? l.slice(0, width) : l}
        </Text>
      ))}
    </Box>
  );
}
