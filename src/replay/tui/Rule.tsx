import { Text } from "ink";
import { color } from "./theme";

interface Props {
  /** Inner width of the frame the rule sits inside. */
  width: number;
}

/**
 * A single-row horizontal divider, dimmed to read as chrome. Rendered inside
 * the frame's padding so it sits inset from the border — a deliberate rule
 * rather than a (impossible-in-Ink) merged T-junction.
 */
export function Rule({ width }: Props) {
  return (
    <Text color={color.chrome} dimColor>
      {"─".repeat(Math.max(0, width))}
    </Text>
  );
}
