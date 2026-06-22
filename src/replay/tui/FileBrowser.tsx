import { readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { Box, Text, useInput, useStdin } from "ink";
import { useEffect, useMemo, useState } from "react";
import { fitText } from "./layout";
import { color, icon } from "./theme";

interface Entry {
  name: string;
  path: string;
  isDir: boolean;
  isJson: boolean;
}

interface Props {
  initialCwd: string;
  initialSelected?: string[];
  disabled?: boolean;
  /** Inner width available for the browser body. */
  width?: number;
  /** Inner height available for the browser body. */
  height?: number;
  onBegin: (files: string[]) => void;
  /** Convert-only: write _scenario.json for raw logs in the selection without
   * running. No-op when nothing is selected. */
  onConvert?: (files: string[]) => void;
  onQuit: () => void;
  /** Notified whenever the user adds/removes a file so the parent can keep
   * derived UI (e.g. the [B] begin hint) in sync with the live selection. */
  onSelectionChange?: (count: number) => void;
  /** Notified when the working directory changes so the parent can show it. */
  onCwdChange?: (cwd: string) => void;
}

const isJsonName = (n: string) => n.toLowerCase().endsWith(".json");

function readEntries(dir: string): Entry[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out: Entry[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (!isDir && !isJsonName(name)) continue;
    out.push({ name, path: full, isDir, isJson: !isDir });
  }
  out.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function FileBrowser({
  initialCwd,
  initialSelected = [],
  disabled = false,
  width = 80,
  height = 16,
  onBegin,
  onConvert,
  onQuit,
  onSelectionChange,
  onCwdChange,
}: Props) {
  const [cwd, setCwd] = useState<string>(resolve(initialCwd));
  const [cursor, setCursor] = useState<number>(0);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected.map((p) => (isAbsolute(p) ? p : resolve(p)))),
  );
  const { isRawModeSupported } = useStdin();

  useEffect(() => {
    onSelectionChange?.(selected.size);
  }, [selected, onSelectionChange]);

  useEffect(() => {
    onCwdChange?.(cwd);
  }, [cwd, onCwdChange]);

  const entries = useMemo(() => readEntries(cwd), [cwd]);
  const showParent = dirname(cwd) !== cwd;
  const total = (showParent ? 1 : 0) + entries.length;

  const goUp = () => {
    const parent = dirname(cwd);
    if (parent === cwd) return;
    setCwd(parent);
    setCursor(0);
  };

  const enterIndex = (i: number) => {
    if (showParent && i === 0) {
      goUp();
      return;
    }
    const e = entries[i - (showParent ? 1 : 0)];
    if (!e) return;
    if (e.isDir) {
      setCwd(e.path);
      setCursor(0);
    } else if (e.isJson) {
      toggleSelect(e.path);
    }
  };

  const toggleSelect = (full: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(full)) next.delete(full);
      else next.add(full);
      return next;
    });
  };

  const selectAllJsonHere = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const e of entries) if (e.isJson) next.add(e.path);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  useInput(
    (input, key) => {
      if (key.upArrow) {
        setCursor((c) => Math.max(0, c - 1));
      } else if (key.downArrow) {
        setCursor((c) => Math.min(total - 1, c + 1));
      } else if (key.pageUp) {
        setCursor((c) => Math.max(0, c - 10));
      } else if (key.pageDown) {
        setCursor((c) => Math.min(total - 1, c + 10));
      } else if (key.return) {
        enterIndex(cursor);
      } else if (input === " ") {
        if (!showParent || cursor !== 0) {
          const e = entries[cursor - (showParent ? 1 : 0)];
          if (e?.isJson) toggleSelect(e.path);
        }
      } else if (key.leftArrow || key.backspace || input === "u") {
        goUp();
      } else if (input === "a") {
        selectAllJsonHere();
      } else if (input === "c") {
        clearSelection();
      } else if (input === "B" || (input === "b" && selected.size > 0)) {
        if (selected.size > 0) onBegin(Array.from(selected).sort());
      } else if (input === "v") {
        if (selected.size > 0) onConvert?.(Array.from(selected).sort());
      } else if (input === "q") {
        onQuit();
      }
    },
    { isActive: isRawModeSupported === true && !disabled },
  );

  // One row is spent on each column's title; the rest is the scroll window.
  const visibleRows = Math.max(1, height - 1);
  const start = Math.max(
    0,
    Math.min(cursor - Math.floor(visibleRows / 2), total - visibleRows),
  );
  const end = Math.min(total, start + visibleRows);

  const leftW = Math.max(16, Math.min(Math.floor(width * 0.55), 60));
  // Right column: total minus left, minus the 1-col separator and 1-col pad.
  const rightW = Math.max(12, width - leftW - 2);

  const dirRows: Array<{
    key: string;
    label: string;
    isDir: boolean;
    isSelected: boolean;
    isCursor: boolean;
  }> = [];
  for (let i = start; i < end; i++) {
    const isCursor = i === cursor;
    if (showParent && i === 0) {
      dirRows.push({
        key: "..",
        label: "..",
        isDir: true,
        isSelected: false,
        isCursor,
      });
      continue;
    }
    const e = entries[i - (showParent ? 1 : 0)];
    dirRows.push({
      key: e.path,
      label: e.isDir ? `${e.name}/` : e.name,
      isDir: e.isDir,
      isSelected: selected.has(e.path),
      isCursor,
    });
  }
  const dirBlanks = Math.max(0, visibleRows - dirRows.length);

  const selectedList = Array.from(selected).sort();
  const selStart = Math.max(0, selectedList.length - visibleRows);
  const selVisible = selectedList.slice(selStart);
  // When empty, the "(none …)" placeholder occupies one of the rows.
  const selUsed = selectedList.length === 0 ? 1 : selVisible.length;
  const selBlanks = Math.max(0, visibleRows - selUsed);

  return (
    <Box height={height} width={width}>
      <Box
        flexDirection="column"
        width={leftW}
        borderStyle="single"
        borderColor={color.chrome}
        borderTop={false}
        borderBottom={false}
        borderLeft={false}
        borderRight={true}
        paddingRight={1}
      >
        <Text bold>Directory ({entries.length})</Text>
        {dirRows.length === 0 ? <Text dimColor>(empty)</Text> : null}
        {dirRows.map((r) => {
          const marker = !r.isDir && r.isSelected ? icon.done : " ";
          const arrow = r.isCursor ? icon.cursor : " ";
          const c = r.isCursor
            ? color.accent
            : r.isDir
              ? color.dir
              : r.isSelected
                ? color.success
                : undefined;
          return (
            <Text key={r.key} color={c} wrap="truncate-end">
              {fitText(`${arrow} ${marker} ${r.label}`, leftW - 1)}
            </Text>
          );
        })}
        {Array.from({ length: dirBlanks }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: blank padding rows have no identity beyond position
          <Text key={`db-${i}`}> </Text>
        ))}
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        <Text bold>Selected ({selectedList.length})</Text>
        {selectedList.length === 0 ? (
          <Text dimColor>(none — Space/Enter to add)</Text>
        ) : (
          selVisible.map((p) => (
            <Text key={p} color={color.success} wrap="truncate-end">
              {fitText(
                `${icon.done} ${basename(dirname(p))}${sep}${basename(p)}`,
                rightW,
              )}
            </Text>
          ))
        )}
        {Array.from({ length: selBlanks }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: blank padding rows have no identity beyond position
          <Text key={`sb-${i}`}> </Text>
        ))}
      </Box>
    </Box>
  );
}
