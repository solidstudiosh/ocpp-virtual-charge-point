import { Box, Text } from "ink";
import type { AuthSource } from "../connection";
import { fitText } from "./layout";
import { color, icon } from "./theme";

interface FileStatus {
  path: string;
  status: "pending" | "running" | "done" | "failed";
  succeeded?: number;
  rejected?: number;
  /** Resolved OCPP id for this file; shown instead of the path when known. */
  cpId?: string;
  /** Where this file's basic-auth password comes from; drives the badge. */
  authSource?: AuthSource;
}

/** Masked auth indicator — never reveals the password value. */
function authBadge(source?: AuthSource): string {
  switch (source) {
    case "file":
      return "  auth ✓";
    case "cli":
      return "  (cli)";
    case "env":
      return "  (env)";
    default:
      return "";
  }
}

const statusIcon = (s: FileStatus["status"]) =>
  s === "done"
    ? icon.done
    : s === "failed"
      ? icon.rejected
      : s === "running"
        ? icon.running
        : icon.pending;

const statusColor = (s: FileStatus["status"], isCurrent: boolean) =>
  isCurrent
    ? color.accent
    : s === "done"
      ? color.success
      : s === "failed"
        ? color.error
        : s === "running"
          ? color.accent
          : undefined;

interface ListProps {
  files: FileStatus[];
  currentIndex: number;
  /** Content rows to render (windowed + blank-padded). Defaults to all. */
  rows?: number;
  width?: number;
}

/**
 * Vertical batch file list, rendered as borderless content. Windows around the
 * current file and pads to `rows` so it keeps a fixed height. Used on the ready
 * and complete screens.
 */
export function FileQueue({ files, currentIndex, rows, width }: ListProps) {
  if (files.length === 0) return null;
  const budget = rows ?? files.length;

  let start = 0;
  if (files.length > budget) {
    start = Math.max(
      0,
      (currentIndex >= 0 ? currentIndex : 0) - Math.floor(budget / 2),
    );
    start = Math.min(start, files.length - budget);
  }
  const slice = files.slice(start, start + budget);
  const blanks = Math.max(0, budget - slice.length);

  return (
    <Box flexDirection="column">
      {slice.map((f, i) => {
        const idx = start + i;
        const tally =
          f.status === "done" || f.status === "failed"
            ? `  ${icon.done}${f.succeeded ?? 0} ${icon.rejected}${f.rejected ?? 0}`
            : "";
        const label = f.cpId ?? f.path;
        const line = `${statusIcon(f.status)} ${label}${authBadge(f.authSource)}${tally}`;
        return (
          <Text
            key={f.path}
            color={statusColor(f.status, idx === currentIndex)}
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

/**
 * Compact one-line batch indicator (`✓✓▶··`) for the running header. Each file
 * is a single coloured status glyph, so a large batch still fits one line.
 */
export function FileDots({ files, currentIndex }: ListProps) {
  if (files.length <= 1) return null;
  return (
    <Text>
      {files.map((f, i) => (
        <Text
          // biome-ignore lint/suspicious/noArrayIndexKey: dots map positionally to the file list
          key={i}
          color={statusColor(f.status, i === currentIndex)}
        >
          {statusIcon(f.status)}
        </Text>
      ))}
    </Text>
  );
}

export type { FileStatus };
