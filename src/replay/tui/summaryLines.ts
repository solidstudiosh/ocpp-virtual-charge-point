import { basename } from "node:path";
import type { FileResult, SessionRow } from "./state";
import { icon, sessionColor, sessionIcon } from "./theme";

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
