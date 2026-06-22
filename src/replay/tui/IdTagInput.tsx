import { Text } from "ink";
import { color } from "./theme";

interface Props {
  value: string;
  draft: string;
  editing: boolean;
}

/**
 * Single-line idTag-override readout/editor, rendered as borderless content so
 * it can fold into a frame header. While editing it shows the draft with a
 * block cursor and inline key hints.
 */
export function IdTagInput({ value, draft, editing }: Props) {
  return (
    <Text wrap="truncate-end">
      <Text dimColor>idTag </Text>
      {editing ? (
        <>
          <Text color={color.accent}>{draft}</Text>
          <Text color={color.accent}>█</Text>
          <Text dimColor> (Enter confirm · Esc cancel)</Text>
        </>
      ) : (
        <>
          <Text color={value ? color.success : undefined}>
            {value || "(none)"}
          </Text>
          <Text dimColor> [t] edit</Text>
        </>
      )}
    </Text>
  );
}
