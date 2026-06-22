import { Box, Text, useInput, useStdin } from "ink";
import { useRef, useState } from "react";
import { color } from "./theme";

export interface ConvertFormValues {
  stationId: string;
  password: string;
  rebaseTimestamps: boolean;
}

export interface ConvertWizardStats {
  calls: number;
  sessions: number;
  dropped: number;
  corrupt: number;
}

interface Props {
  /** Basename of the source file, for the heading. */
  fileLabel: string;
  /** 0-based position in the wizard queue. */
  index: number;
  total: number;
  initialStationId: string;
  /** Parse summary; undefined when the file failed to parse. */
  stats?: ConvertWizardStats;
  /** When set, the form is read-only: enter skips (drops the file). */
  error?: string;
  width: number;
  onAccept: (values: ConvertFormValues) => void;
  onSkip: () => void;
  onCancel: () => void;
}

const FIELD_ROWS = ["stationId", "password", "timestamps"] as const;

/**
 * One conversion form: stationId (prefilled from the filename), optional
 * password, and the rebase-timestamps toggle. Rendered inside the app frame
 * for each raw-log file the user committed in the selection screen.
 */
export function ConvertWizard({
  fileLabel,
  index,
  total,
  initialStationId,
  stats,
  error,
  width,
  onAccept,
  onSkip,
  onCancel,
}: Props) {
  const [stationId, setStationId] = useState(initialStationId);
  const [password, setPassword] = useState("");
  const [rebase, setRebase] = useState(true);
  const [row, setRow] = useState(0);
  // Keep a ref so the input handler always reads the latest row without
  // waiting for a re-render — important when two stdin events fire back-to-back
  // in tests (and in rapid real-user input).
  const rowRef = useRef(row);
  const { isRawModeSupported } = useStdin();
  const errorMode = error !== undefined;

  useInput(
    (input, key) => {
      if (key.escape) {
        onCancel();
        return;
      }
      if (errorMode) {
        if (key.return) onSkip();
        return;
      }
      if (key.return) {
        if (stationId.trim().length === 0) return;
        onAccept({
          stationId: stationId.trim(),
          password,
          rebaseTimestamps: rebase,
        });
        return;
      }
      if (key.upArrow) {
        setRow((r) => {
          const next = Math.max(0, r - 1);
          rowRef.current = next;
          return next;
        });
        return;
      }
      if (key.downArrow) {
        setRow((r) => {
          const next = Math.min(FIELD_ROWS.length - 1, r + 1);
          rowRef.current = next;
          return next;
        });
        return;
      }
      if (FIELD_ROWS[rowRef.current] === "timestamps") {
        if (key.leftArrow || key.rightArrow || input === " ") {
          setRebase((v) => !v);
        }
        return;
      }
      const set =
        FIELD_ROWS[rowRef.current] === "stationId" ? setStationId : setPassword;
      if (key.backspace || key.delete) {
        set((v) => v.slice(0, -1));
      } else if (input && input.length > 0 && !key.ctrl && !key.meta) {
        set((v) => v + input);
      }
    },
    { isActive: isRawModeSupported === true },
  );

  const textField = (label: string, value: string, focused: boolean) => (
    <Text wrap="truncate-end">
      <Text dimColor>{label.padEnd(12)}</Text>
      <Text color={focused && !errorMode ? color.accent : undefined}>
        [{value}]
      </Text>
      {focused && !errorMode ? <Text color={color.accent}>█</Text> : null}
    </Text>
  );

  const toggleFocused = FIELD_ROWS[row] === "timestamps" && !errorMode;
  const statsLine = stats
    ? `parsed: ${stats.calls} calls · ${stats.sessions} session${
        stats.sessions === 1 ? "" : "s"
      } · ${stats.dropped} dropped${
        stats.corrupt > 0 ? ` · ${stats.corrupt} corrupt` : ""
      }`
    : undefined;
  const hints = errorMode
    ? "enter continue (file dropped) · esc back to selection"
    : "enter accept · ↑/↓ field · esc back to selection";

  return (
    <Box flexDirection="column" width={width}>
      <Text wrap="truncate-end">
        <Text bold>{fileLabel}</Text>
        <Text dimColor>{`  file ${index + 1}/${total}`}</Text>
      </Text>
      <Text> </Text>
      {textField("stationId", stationId, FIELD_ROWS[row] === "stationId")}
      {textField("password", password, FIELD_ROWS[row] === "password")}
      <Text wrap="truncate-end">
        <Text dimColor>{"timestamps".padEnd(12)}</Text>
        <Text color={toggleFocused ? color.accent : undefined}>
          {rebase
            ? "(•) rebase to now   ( ) keep original"
            : "( ) rebase to now   (•) keep original"}
        </Text>
      </Text>
      <Text> </Text>
      {error ? <Text color={color.error}>{error}</Text> : null}
      {statsLine ? <Text dimColor>{statsLine}</Text> : null}
      <Text dimColor wrap="truncate-end">
        {hints}
      </Text>
    </Box>
  );
}
