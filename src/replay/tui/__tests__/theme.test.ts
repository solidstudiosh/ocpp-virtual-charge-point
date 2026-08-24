import { RGBA, TextRenderable } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyThemeMode,
  color,
  levelColor,
  sessionColor,
  sessionIcon,
} from "../theme";

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

describe("theme mode", () => {
  // Restore the default so mode changes cannot leak between test files.
  afterEach(() => applyThemeMode("dark"));

  it("darkens body text for light terminals", () => {
    applyThemeMode("dark");
    const darkText = color.text;
    applyThemeMode("light");
    expect(color.text).not.toBe(darkText);
    // Light-mode body text must be dark enough to read on white.
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(color.text.slice(i, i + 2), 16),
    );
    expect((r + g + b) / 3).toBeLessThan(128);
  });

  it("restores the dark palette", () => {
    applyThemeMode("light");
    applyThemeMode("dark");
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(color.text.slice(i, i + 2), 16),
    );
    expect((r + g + b) / 3).toBeGreaterThan(128);
  });

  it("keeps every semantic token defined in both modes", () => {
    for (const mode of ["light", "dark"] as const) {
      applyThemeMode(mode);
      for (const key of [
        "accent",
        "success",
        "error",
        "warn",
        "dir",
        "chrome",
        "dim",
        "text",
      ] as const) {
        expect(color[key]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  // Closes the coverage gap the Task 3 review flagged as a Minor.
  it("maps every session status to its semantic colour", () => {
    applyThemeMode("dark");
    expect(sessionColor("rejected")).toBe(color.error);
    expect(sessionColor("truncated")).toBe(color.warn);
    expect(sessionColor("running")).toBe(color.accent);
  });

  // captureCharFrame() strips colour, so this renders through the real Core
  // pipeline and reads back actual RGBA via captureSpans() — proving the
  // token the palette produces is what a widget's `fg` actually paints,
  // not just that the string constant changed.
  it("reaches rendered output: a widget's fg is the active palette's RGBA", async () => {
    applyThemeMode("light");
    const lightText = color.text;
    const t = await createTestRenderer({ width: 10, height: 3 });
    const probe = new TextRenderable(t.renderer, {
      id: "theme-probe",
      content: "x",
      fg: color.text,
    });
    t.renderer.root.add(probe);
    await t.waitForVisualIdle();
    await t.renderOnce();
    const span = t.captureSpans().lines[0].spans[0];
    expect(Array.from(span.fg.buffer)).toEqual(
      Array.from(RGBA.fromHex(lightText).buffer),
    );
    // Guards against a vacuous pass: rendered fg must not be Core's
    // no-inherit-sentinel white the brief calls out as the failure mode.
    expect(Array.from(span.fg.buffer)).not.toEqual([255, 255, 255, 255]);
  });
});
