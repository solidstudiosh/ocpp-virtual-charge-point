import { basename } from "node:path";
import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { FileStatus } from "./FileQueue";
import { fmtDuration } from "./format";
import { fitText } from "./layout";
import type { FileResult, SessionRow } from "./state";
import { color, icon, sessionColor, sessionIcon } from "./theme";

export interface SummaryLine {
  key: string;
  text: string;
  color?: string;
  bold?: boolean;
}

function sessionLabel(s: SessionRow): string {
  const idx = s.index.toString().padStart(3, "0");
  return `s${idx} c${s.connectorId ?? "?"} ${s.idTag ?? "?"}`;
}

/**
 * Flatten archived file results into renderable lines: a header per file
 * (basename + tallies) followed by one line per session — successes with
 * their transaction id, rejections with reason plus a failed-at line,
 * truncations labelled. Pure so the breakdown is testable without Ink.
 */
export function buildSummaryLines(results: FileResult[]): SummaryLine[] {
  const lines: SummaryLine[] = [];
  for (const r of results) {
    const done = r.sessions.filter((s) => s.status === "done").length;
    const rejected = r.sessions.filter((s) => s.status === "rejected").length;
    const truncated = r.sessions.filter((s) => s.status === "truncated").length;
    lines.push({
      key: `file:${r.file}`,
      text: `${icon.send} ${basename(r.file)}  ${icon.done}${done} ${icon.rejected}${rejected} ${icon.truncated}${truncated}`,
      bold: true,
    });
    for (const s of r.sessions) {
      const key = `${r.file}:${s.index}`;
      const head = `  ${sessionIcon(s.status)} ${sessionLabel(s)}`;
      const tx = s.txId !== undefined ? `tx ${s.txId}` : "";
      if (s.status === "rejected") {
        lines.push({
          key,
          text: `${head}  ${s.reason ?? "rejected"}`,
          color: sessionColor(s.status),
        });
        if (s.failedAt) {
          lines.push({
            key: `${key}:at`,
            text: `       at ${s.failedAt.action} #${s.failedAt.messageIndex}`,
            color: sessionColor(s.status),
          });
        }
      } else if (s.status === "truncated") {
        lines.push({
          key,
          text: `${head}  truncated${tx ? ` ${tx}` : ""}`,
          color: sessionColor(s.status),
        });
      } else {
        lines.push({
          key,
          text: `${head}  ${tx || "—"}`,
          color: sessionColor(s.status),
        });
      }
    }
  }
  return lines;
}

interface Props {
  fileResults: FileResult[];
  files: FileStatus[];
  width: number;
  /** Total rows available for the summary body (headline + session list). */
  height: number;
  /** Enables the scroll key handler (raw-mode TTYs only). */
  interactive: boolean;
}

/** Rows used by the headline block (banner, tallies, duration, caption). */
const HEADLINE_ROWS = 4;

/**
 * Post-run breakdown for the complete screen: a pass/fail banner with batch
 * totals, then every session grouped per file in a scrollable, blank-padded
 * window (↑/↓ one line, PgUp/PgDn one page) that honours the constant-height
 * invariant.
 */
export function SummaryScreen({
  fileResults,
  files,
  width,
  height,
  interactive,
}: Props) {
  const lines = buildSummaryLines(fileResults);
  const listRows = Math.max(1, height - HEADLINE_ROWS);
  const maxScroll = Math.max(0, lines.length - listRows);
  const [scroll, setScroll] = useState(0);

  // Re-clamp if the viewport grows (terminal resize) after scrolling deep.
  useEffect(() => {
    setScroll((s) => Math.min(s, maxScroll));
  }, [maxScroll]);

  useInput(
    (_input, key) => {
      if (key.upArrow) setScroll((s) => Math.max(0, s - 1));
      else if (key.downArrow) setScroll((s) => Math.min(maxScroll, s + 1));
      else if (key.pageUp) setScroll((s) => Math.max(0, s - listRows));
      else if (key.pageDown)
        setScroll((s) => Math.min(maxScroll, s + listRows));
    },
    { isActive: interactive },
  );

  const totals = fileResults.reduce(
    (acc, r) => {
      for (const s of r.sessions) {
        if (s.status === "done") acc.done++;
        else if (s.status === "rejected") acc.rejected++;
        else if (s.status === "truncated") acc.truncated++;
      }
      acc.sessions += r.sessions.length;
      acc.exitCode = Math.max(acc.exitCode, r.summary?.exitCode ?? 0);
      acc.durationMs += r.summary?.durationMs ?? 0;
      return acc;
    },
    {
      done: 0,
      rejected: 0,
      truncated: 0,
      sessions: 0,
      exitCode: 0,
      durationMs: 0,
    },
  );
  const filesDone = files.filter((f) => f.status === "done").length;
  const filesFailed = files.filter((f) => f.status === "failed").length;
  const ok = totals.exitCode === 0;

  const slice = lines.slice(scroll, scroll + listRows);
  const blanks = Math.max(0, listRows - slice.length);
  const caption =
    lines.length > listRows
      ? `SESSIONS  ${scroll + 1}–${Math.min(scroll + listRows, lines.length)}/${lines.length}  ↑↓ scroll`
      : "SESSIONS";

  return (
    <Box flexDirection="column" height={height}>
      <Text bold color={ok ? color.success : color.error} wrap="truncate-end">
        {ok ? icon.done : icon.rejected} replay complete — exit{" "}
        {totals.exitCode}
      </Text>
      <Text wrap="truncate-end">
        files <Text color={color.success}>{filesDone}</Text> ok,{" "}
        <Text color={color.error}>{filesFailed}</Text> failed of {files.length}
        {"  ·  sessions "}
        <Text color={color.success}>
          {icon.done}
          {totals.done}
        </Text>{" "}
        <Text color={color.error}>
          {icon.rejected}
          {totals.rejected}
        </Text>{" "}
        <Text color={color.warn}>
          {icon.truncated}
          {totals.truncated}
        </Text>{" "}
        of {totals.sessions}
      </Text>
      <Text wrap="truncate-end">
        duration <Text bold>{fmtDuration(totals.durationMs)}</Text>
      </Text>
      <Text bold wrap="truncate-end">
        {caption}
      </Text>
      {slice.map((l) => (
        <Text key={l.key} bold={l.bold} color={l.color} wrap="truncate-end">
          {fitText(l.text, width)}
        </Text>
      ))}
      {Array.from({ length: blanks }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: blank padding rows have no identity beyond position
        <Text key={`blank-${i}`}> </Text>
      ))}
    </Box>
  );
}
