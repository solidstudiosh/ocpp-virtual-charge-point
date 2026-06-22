import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { App, type AppController } from "../App";

function flush() {
  return new Promise((r) => setTimeout(r, 10));
}

function makeFixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "file-browser-test-"));
  writeFileSync(join(dir, "a.json"), '{"stationId":"X","sessions":[]}');
  writeFileSync(join(dir, "b.json"), '{"stationId":"Y","sessions":[]}');
  return dir;
}

describe("FileBrowser <-> HelpBar canBegin sync", () => {
  it("HelpBar omits [B] begin when no files are selected, shows it after selection", async () => {
    const dir = makeFixtureDir();
    let ctrl!: AppController;
    const { lastFrame, stdin } = render(
      <App
        endpoint="ws://localhost:3000"
        initialFiles={[]}
        cwd={dir}
        onReady={(c) => {
          ctrl = c;
        }}
      />,
    );
    await flush();
    expect(ctrl).toBeDefined();

    // Initially no files are selected; HelpBar must not advertise [B] begin.
    const before = lastFrame() ?? "";
    expect(before).not.toContain("[B] begin");

    // "a" selects every .json in the current directory (FileBrowser's
    // all-here hotkey). Avoids depending on arrow-key escape sequences.
    stdin.write("a");
    await flush();

    const after = lastFrame() ?? "";
    expect(after).toContain("[B] begin");

    // "c" clears the selection -> [B] begin should disappear again.
    stdin.write("c");
    await flush();
    const cleared = lastFrame() ?? "";
    expect(cleared).not.toContain("[B] begin");
  });
});
