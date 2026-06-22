import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { FileQueue, type FileStatus } from "../FileQueue";

function file(overrides: Partial<FileStatus>): FileStatus {
  return { path: "data/x.json", status: "pending", ...overrides };
}

describe("FileQueue connection identity", () => {
  it("shows the resolved CP ID and an 'auth ✓' badge for file-sourced auth", () => {
    const files: FileStatus[] = [
      file({ cpId: "CS_TEST_1", authSource: "file" }),
    ];
    const frame =
      render(<FileQueue files={files} currentIndex={0} />).lastFrame() ?? "";
    expect(frame).toContain("CS_TEST_1");
    expect(frame).toContain("auth ✓");
  });

  it("shows an '(env)' badge when auth falls back to the environment", () => {
    const files: FileStatus[] = [
      file({ cpId: "CS_TEST_4", authSource: "env" }),
    ];
    const frame =
      render(<FileQueue files={files} currentIndex={0} />).lastFrame() ?? "";
    expect(frame).toContain("CS_TEST_4");
    expect(frame).toContain("(env)");
  });

  it("shows the id with no auth badge when no password is set", () => {
    const files: FileStatus[] = [
      file({ cpId: "CS_TEST_5", authSource: "none" }),
    ];
    const frame =
      render(<FileQueue files={files} currentIndex={0} />).lastFrame() ?? "";
    expect(frame).toContain("CS_TEST_5");
    expect(frame).not.toContain("auth ✓");
    expect(frame).not.toContain("(env)");
  });

  it("falls back to the file path when no CP ID is known", () => {
    const files: FileStatus[] = [file({ path: "data/unknown.json" })];
    const frame =
      render(<FileQueue files={files} currentIndex={0} />).lastFrame() ?? "";
    expect(frame).toContain("data/unknown.json");
  });
});
