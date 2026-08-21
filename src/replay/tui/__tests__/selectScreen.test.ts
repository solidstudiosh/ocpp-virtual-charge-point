import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSelectScreen } from "../screens/select";
import { renderView } from "../testHarness";
import { icon } from "../theme";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "vcp-select-"));
  mkdirSync(join(dir, "nested"));
  writeFileSync(join(dir, "CS_TEST_1.json"), "{}");
  writeFileSync(join(dir, "CS_TEST_2.json"), "{}");
  writeFileSync(join(dir, "notes.txt"), "ignore me");
  // Non-empty, so the cursor's position after navigating in is observable:
  // an empty directory renders only the ".." row regardless of where the
  // cursor actually sits.
  writeFileSync(join(dir, "nested", "CS_TEST_3.json"), "{}");
  return dir;
}

const props = (dir: string, over = {}) => ({
  cwd: dir,
  selected: [] as string[],
  fileStatusFor: (path: string) => ({ path, status: "pending" as const }),
  idTag: "",
  editingIdTag: false,
  width: 90,
  height: 20,
  ...over,
});

describe("select screen", () => {
  it("lists directories and json files, hiding other extensions", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    const frame = await h.frame();
    expect(frame).toContain("SELECT FILES");
    expect(frame).toContain("nested/");
    expect(frame).toContain("CS_TEST_1.json");
    expect(frame).not.toContain("notes.txt");
    h.destroy();
  });

  it("selects all json in the directory and reports the count", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    h.view.selectAll();
    expect(h.view.selection()).toHaveLength(2);
    expect(await h.frame()).toContain("2 selected");

    h.view.clear();
    expect(h.view.selection()).toHaveLength(0);
    h.destroy();
  });

  it("shows the resolved cpId and auth badge for selected files", async () => {
    const dir = fixture();
    const path = join(dir, "CS_TEST_1.json");
    const h = await renderView(
      createSelectScreen,
      props(dir, {
        selected: [path],
        fileStatusFor: (p: string) => ({
          path: p,
          status: "pending" as const,
          cpId: "CS_TEST_1",
          authSource: "file" as const,
        }),
      }),
      { width: 90, height: 20 },
    );
    const frame = await h.frame();
    // The right pane must show the RESOLVED id, not the raw path. The
    // fixture is named CS_TEST_1.json, so a bare-path regression would
    // still contain "CS_TEST_1" — the absent ".json" is what proves it.
    const lines = frame.split("\n");
    const selectedPane = lines.filter((l) => l.includes("auth ✓")).join("\n");
    expect(selectedPane).toContain("CS_TEST_1");
    expect(selectedPane).not.toContain(".json");
    h.destroy();
  });

  it("only offers begin once something is selected", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    expect(await h.frame()).not.toContain("[B] begin");

    h.view.selectAll();
    expect(await h.frame()).toContain("[B] begin");
    h.destroy();
  });

  it("navigates into a directory and resets the cursor", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    h.view.move(1); // off the ".." row, onto "nested/"
    h.view.open();
    const frame = await h.frame();
    expect(frame).toContain("nested");
    // nested/ has its own entry (CS_TEST_3.json), so — unlike an empty
    // directory — where the cursor lands is actually observable: the
    // cursor marker must sit on the ".." row, not on that entry. Match an
    // isolated ".." (not the title bar's "..." path-truncation ellipsis).
    const parentLine = frame
      .split("\n")
      .find((l) => /(?<!\.)\.\.(?!\.)/.test(l));
    expect(parentLine).toBeDefined();
    expect(parentLine).toContain(icon.cursor);
    h.destroy();
  });

  it("is inert at the filesystem root", async () => {
    const h = await renderView(createSelectScreen, props("/"), {
      width: 90,
      height: 20,
    });
    const before = await h.frame();
    h.view.up();
    expect(await h.frame()).toBe(before);
    h.destroy();
  });

  it("clamps the cursor at both ends", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    h.view.move(-100);
    h.view.page(-100);
    const top = await h.frame();
    h.view.move(100);
    h.view.page(100);
    const bottom = await h.frame();
    expect(top).not.toBe(bottom); // the cursor genuinely moved
    h.destroy();
  });

  it("toggles a file into and out of the selection", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    h.view.move(2); // onto a .json file — dirs sort first, so row 2 is a file
    h.view.toggle();
    expect(h.view.selection()).toHaveLength(1);
    h.view.toggle();
    expect(h.view.selection()).toHaveLength(0);
    h.destroy();
  });
});
