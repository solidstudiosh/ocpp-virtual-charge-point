import { Box } from "ink";
import { ProgressBar } from "./ProgressBar";
import type { TuiState } from "./state";
import { color } from "./theme";

interface Props {
  state: TuiState;
  /** Inner width available for the strip. */
  width: number;
}

/**
 * The three batch/session progress bars compacted onto a single row. Bar width
 * scales with available space and collapses to a counts-only readout on narrow
 * terminals so the strip always fits one line (never wraps to a second row,
 * which would break the fixed-height invariant).
 */
export function ProgressStrip({ state, width }: Props) {
  // Rough per-bar overhead: label + percent + counts + separators. Below this
  // budget we drop the bar glyphs entirely and show numbers only.
  const barWidth = width >= 78 ? 10 : width >= 60 ? 6 : 0;
  return (
    <Box>
      <Box marginRight={2}>
        <ProgressBar
          label="Sess"
          current={state.batchSessionsDone}
          total={state.batchTotalSessions}
          barWidth={barWidth}
          color={color.accent}
        />
      </Box>
      <Box marginRight={2}>
        <ProgressBar
          label="Msg"
          current={state.batchMessagesSent}
          total={state.batchTotalMessages}
          barWidth={barWidth}
          color="magenta"
        />
      </Box>
      <ProgressBar
        label="Cur"
        current={state.currentSessionMessagesSent}
        total={state.currentSessionMessagesPlanned ?? 0}
        barWidth={barWidth}
        color={color.success}
      />
    </Box>
  );
}
