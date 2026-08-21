import type { InputRenderable } from "@opentui/core";
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import { createConvertScreen } from "../screens/convert";

const props = (over = {}) => ({
  fileLabel: "CS_TEST_1.log",
  index: 0,
  total: 2,
  initialStationId: "CS_TEST_1",
  stats: { calls: 120, sessions: 3, dropped: 1, corrupt: 0 },
  width: 80,
  height: 16,
  ...over,
});

/**
 * The text of the row whose label starts with `label`, with the label
 * itself and border/whitespace filler stripped away. An `InputRenderable`
 * can scroll so only a suffix of its value is on screen, so checking for
 * the full value as a whole-frame substring is unreliable; scoping to the
 * row and stripping only the label keeps the assertion honest about what
 * is actually left over on that line.
 */
function rowRemainder(frame: string, label: string): string {
  const line = frame.split("\n").find((l) => l.includes(label));
  if (line === undefined) throw new Error(`no row for label ${label}`);
  return line.slice(line.indexOf(label) + label.length).replace(/[│\s]/g, "");
}

describe("convert screen", () => {
  it("prefills the station id and shows parse stats and queue position", async () => {
    const h = await renderView(createConvertScreen, props(), {
      width: 80,
      height: 16,
    });
    const frame = await h.frame();
    expect(frame).toContain("CS_TEST_1.log");
    expect(frame).toContain("1/2");
    expect(frame).toContain("CS_TEST_1");
    expect(frame).toContain("120");
    expect(h.view.values().stationId).toBe("CS_TEST_1");
    h.destroy();
  });

  it("defaults rebase-timestamps on and toggles it", async () => {
    const h = await renderView(createConvertScreen, props(), {
      width: 80,
      height: 16,
    });
    expect(h.view.values().rebaseTimestamps).toBe(true);
    h.view.toggleRebase();
    expect(h.view.values().rebaseTimestamps).toBe(false);
    h.destroy();
  });

  it("blocks accept when the station id is blank", async () => {
    const h = await renderView(
      createConvertScreen,
      props({ initialStationId: "" }),
      { width: 80, height: 16 },
    );
    expect(h.view.canAccept()).toBe(false);
    h.destroy();
  });

  it("enters read-only error mode when the file failed to parse", async () => {
    const h = await renderView(
      createConvertScreen,
      props({ error: "unreadable frame at line 4", stats: undefined }),
      { width: 80, height: 16 },
    );
    const frame = await h.frame();
    expect(frame).toContain("unreadable frame at line 4");
    expect(h.view.isErrorMode()).toBe(true);
    h.destroy();
  });

  it("allows accept for a non-blank station id", async () => {
    const h = await renderView(createConvertScreen, props(), {
      width: 80,
      height: 16,
    });
    expect(h.view.canAccept()).toBe(true);
    h.destroy();
  });

  it("blocks accept when the station id is whitespace-only", async () => {
    const h = await renderView(
      createConvertScreen,
      props({ initialStationId: "   " }),
      { width: 80, height: 16 },
    );
    expect(h.view.canAccept()).toBe(false);
    h.destroy();
  });

  it("blocks accept in error mode even with a valid station id, and hides the inputs", async () => {
    const h = await renderView(
      createConvertScreen,
      props({
        initialStationId: "CS_TEST_9",
        error: "unreadable frame at line 4",
        stats: undefined,
      }),
      { width: 80, height: 16 },
    );
    const frame = await h.frame();
    // Scoped to the stationId row: nothing but the label and border/padding
    // survives once the input is hidden. A whole-frame substring check
    // would be fooled by the InputRenderable's horizontal scroll clipping
    // the leading characters of the value even while still visible.
    expect(rowRemainder(frame, "stationId")).toBe("");
    expect(rowRemainder(frame, "password")).toBe("");
    expect(h.view.isErrorMode()).toBe(true);
    // The station id is still held by the form; canAccept is false because
    // of error mode, not because the id is blank.
    expect(h.view.values().stationId).toBe("CS_TEST_9");
    expect(h.view.canAccept()).toBe(false);
    h.destroy();
  });

  it("resets the form (clears password, re-seeds station id) when the file changes", async () => {
    const h = await renderView(createConvertScreen, props(), {
      width: 80,
      height: 16,
    });
    const passwordInput = h.view.root.findDescendantById(
      "password-input",
    ) as InputRenderable;
    passwordInput.value = "PW_TEST_DRAFT";
    expect(h.view.values().password).toBe("PW_TEST_DRAFT");

    h.view.update(
      props({ fileLabel: "next_file.log", initialStationId: "CS_TEST_2" }),
    );

    expect(h.view.values().password).toBe("");
    expect(h.view.values().stationId).toBe("CS_TEST_2");
    h.destroy();
  });

  it("preserves in-progress edits on update() when the file label is unchanged", async () => {
    const h = await renderView(createConvertScreen, props(), {
      width: 80,
      height: 16,
    });
    const passwordInput = h.view.root.findDescendantById(
      "password-input",
    ) as InputRenderable;
    passwordInput.value = "PW_TEST_DRAFT";
    h.view.toggleRebase();

    // Same fileLabel, different stats — e.g. a progress tick on the same
    // file — must not clobber the in-progress edit.
    h.view.update(
      props({ stats: { calls: 121, sessions: 3, dropped: 1, corrupt: 0 } }),
    );

    expect(h.view.values().password).toBe("PW_TEST_DRAFT");
    expect(h.view.values().rebaseTimestamps).toBe(false);
    h.destroy();
  });
});
