import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSelectScreen } from "../screens/select";
import { renderView } from "../testHarness";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "vcp-select-"));
  mkdirSync(join(dir, "nested"));
  writeFileSync(join(dir, "CS_TEST_1.json"), "{}");
  writeFileSync(join(dir, "CS_TEST_2.json"), "{}");
  writeFileSync(join(dir, "notes.txt"), "ignore me");
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
    expect(frame).toContain("CS_TEST_1");
    expect(frame).toContain("auth ✓");
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
});
