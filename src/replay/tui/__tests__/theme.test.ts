import { describe, expect, it } from "vitest";
import { color, levelColor, sessionColor, sessionIcon } from "../theme";

describe("theme", () => {
  it("maps session status to icon and colour", () => {
    expect(sessionIcon("done")).toBe("✓");
    expect(sessionIcon("rejected")).toBe("✗");
    expect(sessionIcon("truncated")).toBe("⊘");
    expect(sessionIcon("running")).toBe("▶");
    expect(sessionIcon("pending")).toBe("·");
    expect(sessionColor("done")).toBe(color.success);
    expect(sessionColor("pending")).toBe(color.text);
  });

  it("maps log level to colour, defaulting to body text", () => {
    expect(levelColor("error")).toBe(color.error);
    expect(levelColor("warn")).toBe(color.warn);
    expect(levelColor("info")).toBe(color.text);
  });

  it("exposes a dim token distinct from body text", () => {
    expect(color.dim).not.toBe(color.text);
  });
});
