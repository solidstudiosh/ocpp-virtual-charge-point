import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import type { FileStatus } from "../widgets/fileQueue";
import {
  createFileDots,
  createFileQueue,
  formatFileRow,
} from "../widgets/fileQueue";

const f = (over: Partial<FileStatus> = {}): FileStatus => ({
  path: "./data/CS_TEST_1.json",
  status: "pending",
  ...over,
});

describe("FileQueue", () => {
  it("prefers the resolved cpId over the raw path", () => {
    expect(formatFileRow(f({ cpId: "CS_TEST_1" }))).toContain("CS_TEST_1");
    expect(formatFileRow(f({ cpId: "CS_TEST_1" }))).not.toContain(".json");
  });

  it("shows a masked auth badge that never reveals the password", () => {
    expect(formatFileRow(f({ authSource: "file" }))).toContain("auth ✓");
    expect(formatFileRow(f({ authSource: "cli" }))).toContain("(cli)");
    expect(formatFileRow(f({ authSource: "env" }))).toContain("(env)");
    expect(formatFileRow(f())).not.toContain("auth");
  });

  it("shows a tally only once a file has finished", () => {
    const done = formatFileRow(
      f({ status: "done", succeeded: 3, rejected: 1 }),
    );
    expect(done).toContain("✓3");
    expect(done).toContain("✗1");
    expect(formatFileRow(f({ status: "running" }))).not.toContain("✓0");
  });

  it("renders the queue", async () => {
    const h = await renderView(
      createFileQueue,
      { files: [f({ cpId: "CS_TEST_1" })], currentIndex: 0, rows: 3 },
      { width: 50, height: 4 },
    );
    expect(await h.frame()).toContain("CS_TEST_1");
    h.destroy();
  });

  it("recycles row renderables instead of rebuilding them", async () => {
    const files = Array.from({ length: 3 }, (_, i) =>
      f({ path: `./data/CS_TEST_${i}.json`, cpId: `CS_TEST_${i}` }),
    );
    const h = await renderView(
      createFileQueue,
      { files, currentIndex: 0, rows: 3 },
      { width: 50, height: 4 },
    );
    await h.frame();
    const firstRow = h.view.root.getChildren()[0];
    const secondRow = h.view.root.getChildren()[1];

    h.view.update({
      files: [files[0], { ...files[1], status: "done" }, files[2]],
      currentIndex: 0,
      rows: 3,
    });
    await h.frame();

    expect(h.view.root.getChildren()[0]).toBe(firstRow);
    expect(h.view.root.getChildren()[1]).toBe(secondRow);
    h.destroy();
  });

  it("slides the window as the current file advances", async () => {
    const files = Array.from({ length: 20 }, (_, i) =>
      f({ path: `./data/CS_TEST_${i}.json`, cpId: `CS_TEST_${i}` }),
    );
    const h = await renderView(
      createFileQueue,
      { files, currentIndex: 2, rows: 4 },
      { width: 50, height: 5 },
    );

    const before = await h.frame();
    expect(before).toContain("CS_TEST_2");
    expect(before).not.toContain("CS_TEST_15");

    h.view.update({ files, currentIndex: 15, rows: 4 });
    const after = await h.frame();
    expect(after).toContain("CS_TEST_15");
    expect(after).not.toContain("CS_TEST_2");
    h.destroy();
  });

  it("hides surplus rows when the file list shrinks", async () => {
    const files = Array.from({ length: 6 }, (_, i) =>
      f({ path: `./data/CS_TEST_${i}.json`, cpId: `CS_TEST_${i}` }),
    );
    const h = await renderView(
      createFileQueue,
      { files, currentIndex: 0, rows: 6 },
      { width: 50, height: 8 },
    );
    expect(await h.frame()).toContain("CS_TEST_5");

    h.view.update({ files: files.slice(0, 2), currentIndex: 0, rows: 6 });
    const after = await h.frame();
    expect(after).toContain("CS_TEST_1");
    expect(after).not.toContain("CS_TEST_5");
    h.destroy();
  });
});

describe("FileDots", () => {
  it("hides itself for single-file batches", async () => {
    const h = await renderView(
      createFileDots,
      { files: [f()], currentIndex: 0 },
      { width: 20, height: 3 },
    );
    await h.frame();
    expect(h.view.root.visible).toBe(false);
    h.destroy();
  });

  it("shows itself for multi-file batches", async () => {
    const files = [
      f({ status: "done" }),
      f({ status: "running" }),
      f({ status: "pending" }),
    ];
    const h = await renderView(
      createFileDots,
      { files, currentIndex: 1 },
      { width: 20, height: 3 },
    );
    await h.frame();
    expect(h.view.root.visible).toBe(true);
    h.destroy();
  });
});
