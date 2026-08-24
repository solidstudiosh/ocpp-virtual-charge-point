import { createTestRenderer } from "@opentui/core/testing";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { scenarioOutputPath } from "../convertQueue";
import type { ConvertScreenView } from "../screens/convert";
import type { SelectScreenView } from "../screens/select";
import type { FileStatus } from "../widgets/fileQueue";

async function mount(options = {}) {
  const t = await createTestRenderer({ width: 90, height: 22 });
  const app = createApp(t.renderer, {
    endpoint: "ws://localhost:3000",
    initialFiles: [{ path: "./data/demo.json", status: "pending" }],
    autoBegin: true,
    ...options,
  });
  t.renderer.root.add(app.root);
  const frame = async () => {
    await t.waitForVisualIdle();
    await t.renderOnce();
    return t.captureCharFrame();
  };
  return { app, frame };
}

/**
 * A directory containing exactly one raw-OCPP-log JSON file that
 * `isRawLogFile` accepts: an array of `{ timestamp, payload }` entries
 * (newest-first, matching the real export shape) whose payloads are CALL
 * frames (`[2, messageId, action, body]`) for one full StartTransaction ->
 * MeterValues -> StopTransaction session. `sourcePath`/`outputPath` are the
 * raw input and the location the convert wizard writes its output to.
 */
function convertFixtureDir(): {
  dir: string;
  sourcePath: string;
  outputPath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "app-convert-test-"));
  const sourcePath = join(dir, "raw-log.json");
  const entries = [
    {
      timestamp: "2026-01-01T10:10:00.000Z",
      payload: JSON.stringify([
        2,
        "m3",
        "StopTransaction",
        {
          transactionId: 1,
          idTag: "RFID_TEST_1",
          meterStop: 100,
          timestamp: "2026-01-01T10:10:00.000Z",
        },
      ]),
    },
    {
      timestamp: "2026-01-01T10:05:00.000Z",
      payload: JSON.stringify([
        2,
        "m2",
        "MeterValues",
        { connectorId: 1, transactionId: 1, meterValue: [] },
      ]),
    },
    {
      timestamp: "2026-01-01T10:00:00.000Z",
      payload: JSON.stringify([
        2,
        "m1",
        "StartTransaction",
        {
          connectorId: 1,
          idTag: "RFID_TEST_1",
          meterStart: 0,
          timestamp: "2026-01-01T10:00:00.000Z",
        },
      ]),
    },
  ];
  writeFileSync(sourcePath, JSON.stringify(entries));
  return { dir, sourcePath, outputPath: scenarioOutputPath(sourcePath) };
}

/** Mount with the file browser rooted at `dir`, then drive `a` (select all)
 * and `v` (convert-only) — both public `handleKey` actions — to reach the
 * "converting" phase over `dir`'s one raw log. */
async function mountInConvertingPhase(dir: string) {
  const mounted = await mount({ autoBegin: false, initialFiles: [], cwd: dir });
  mounted.app.handleKey({ name: "a" });
  mounted.app.handleKey({ name: "v" });
  return mounted;
}

describe("app", () => {
  it("renders the dashboard and reflects dispatched events", async () => {
    const { app, frame } = await mount();
    app.controller.dispatch({
      type: "run_start",
      ts: "2026-08-21T10:00:00Z",
      stationId: "CS_TEST_1",
      file: "./data/demo.json",
      totalSessions: 1,
    });
    app.controller.dispatch({
      type: "session_start",
      ts: "2026-08-21T10:00:01Z",
      sessionIndex: 0,
      connectorId: "1",
      idTag: "RFID_TEST_1",
      windowStart: "2026-08-21T10:00:00Z",
      messagesPlanned: 2,
    });
    const out = await frame();
    expect(out).toContain("CS_TEST_1");
    expect(out).toContain("cid=1");
    app.destroy();
  });

  it("routes running-phase keys to the replay controller", async () => {
    const { app, frame } = await mount();
    expect(app.controller.controller.paused).toBe(false);
    app.handleKey({ name: "p" });
    expect(app.controller.controller.paused).toBe(true);
    expect(await frame()).toContain("paused");
    app.destroy();
  });

  it("switches to the summary screen and offers another round", async () => {
    const onRoundChoice = vi.fn();
    const { app, frame } = await mount({ onRoundChoice });
    app.controller.showSummary();
    expect(await frame()).toContain("COMPLETE");

    app.handleKey({ name: "f" });
    expect(onRoundChoice).toHaveBeenCalledWith("again");
    expect(await frame()).toContain("SELECT FILES");
    app.destroy();
  });

  it("reflows on resize without losing state", async () => {
    const { app, frame } = await mount();
    app.controller.dispatch({
      type: "run_start",
      ts: "2026-08-21T10:00:00Z",
      stationId: "CS_TEST_1",
      file: "./data/demo.json",
      totalSessions: 1,
    });
    app.resize(58, 12);
    expect(await frame()).toContain("CS_TEST_1");
    app.destroy();
  });

  it("ignores keys bound to inactive phases", async () => {
    const onRoundChoice = vi.fn();
    const { app } = await mount({ onRoundChoice });
    // "f" belongs to the complete phase; we are still running.
    app.handleKey({ name: "f" });
    expect(onRoundChoice).not.toHaveBeenCalled();
    app.destroy();
  });

  it("converting: Enter accepts and actually writes the output file", async () => {
    const { sourcePath, outputPath, dir } = convertFixtureDir();
    const { app, frame } = await mountInConvertingPhase(dir);
    expect(await frame()).toContain("CONVERT");
    expect(existsSync(outputPath)).toBe(false);

    app.handleKey({ name: "return" });

    expect(existsSync(outputPath)).toBe(true);
    const written = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(written.sessions).toHaveLength(1);
    expect(written.sessions[0].idTag).toBe("RFID_TEST_1");
    // handleConvertAccept swaps the raw source for the output in the
    // pending selection, then (convert-only mode) returns to selecting.
    expect(await frame()).toContain("SELECT FILES");
    expect(existsSync(sourcePath)).toBe(true); // source is never overwritten
    app.destroy();
  });

  it("converting: Esc cancels without writing", async () => {
    const { outputPath, dir } = convertFixtureDir();
    const { app, frame } = await mountInConvertingPhase(dir);
    expect(await frame()).toContain("CONVERT");

    app.handleKey({ name: "escape" });

    expect(existsSync(outputPath)).toBe(false);
    expect(await frame()).toContain("SELECT FILES");
    app.destroy();
  });

  it("converting: up/down move focus between fields", async () => {
    const { dir } = convertFixtureDir();
    const { app } = await mountInConvertingPhase(dir);
    const screen = app.currentScreen() as ConvertScreenView;
    expect(screen.focusedRow()).toBe(0);

    app.handleKey({ name: "down" });
    expect(screen.focusedRow()).toBe(1);

    app.handleKey({ name: "down" });
    expect(screen.focusedRow()).toBe(2);

    // Clamps rather than wrapping past the last row.
    app.handleKey({ name: "down" });
    expect(screen.focusedRow()).toBe(2);

    app.handleKey({ name: "up" });
    expect(screen.focusedRow()).toBe(1);
    app.destroy();
  });

  it("converting: space toggles the rebase-timestamps option", async () => {
    const { dir } = convertFixtureDir();
    const { app, frame } = await mountInConvertingPhase(dir);
    // Space only reaches the keymap's toggleRebase action on the toggle row
    // (2). On the stationId/password rows (0/1) a real InputRenderable owns
    // the keyboard once focused, and Space belongs to it (typing a space) —
    // not the keymap. Navigate to the toggle row first.
    const screen = app.currentScreen() as ConvertScreenView;
    app.handleKey({ name: "down" });
    app.handleKey({ name: "down" });
    expect(screen.focusedRow()).toBe(2);
    expect(await frame()).toContain("rebase to now");

    app.handleKey({ name: "space" });
    expect(await frame()).toContain("keep original");

    app.handleKey({ name: "space" });
    expect(await frame()).toContain("rebase to now");
    app.destroy();
  });

  it("SELECTED pane shows the resolved cpId and auth badge, not the raw path", async () => {
    // Regression: AppOptions had no way to inject the real
    // resolveFileConnectionForDisplay-backed resolver, so the select screen
    // always fell back to app.ts's hardcoded `{ path, status: "pending" }`
    // stub — the pane rendered a raw temp-file path instead of identity.
    const dir = mkdtempSync(join(tmpdir(), "app-identity-test-"));
    writeFileSync(join(dir, "CS_TEST_9.json"), "{}");

    const fileStatusFor = (path: string): FileStatus => ({
      path,
      status: "pending",
      cpId: "CS_TEST_9",
      authSource: "file",
    });

    const { app, frame } = await mount({
      autoBegin: false,
      initialFiles: [],
      cwd: dir,
      fileStatusFor,
    });
    app.handleKey({ name: "a" }); // select-all json files in dir

    // Assert the exact rendered row (icon + resolved cpId + auth badge, with
    // formatFileRow's two-space separator before the badge): the hardcoded
    // stub renders "○ <fullpath>" instead, with no "auth ✓" badge at all
    // (authSource is undefined), so this cannot pass against it. A plain
    // substring check on the whole line would be unreliable here: the two-
    // pane layout can place the SELECTED pane's row on the same terminal
    // line as an unrelated left-column browser entry.
    expect(await frame()).toContain("CS_TEST_9  auth ✓");
    app.destroy();
  });

  it("keeps the browsed directory across a rerender instead of resetting to the launch cwd", async () => {
    const root = mkdtempSync(join(tmpdir(), "app-cwd-test-"));
    const subdir = join(root, "scenarios");
    mkdirSync(subdir);
    writeFileSync(join(subdir, "run1.json"), "{}");

    const { app, frame } = await mount({
      autoBegin: false,
      initialFiles: [],
      cwd: root,
    });
    // Sanity: the launch cwd lists the subdirectory, not the file inside it.
    expect(await frame()).toContain("scenarios");

    // Move onto "scenarios/" (index 0 is "..") and enter it.
    app.handleKey({ name: "down" });
    app.handleKey({ name: "return" });
    expect(await frame()).toContain("run1.json");

    // A rerender unrelated to navigation (resize) must not reset the
    // browsed directory back to the launch cwd — this used to happen on
    // *every* rerender, including a winston log line arriving mid-browse.
    app.resize(90, 22);
    expect(await frame()).toContain("run1.json");

    const screen = app.currentScreen() as SelectScreenView;
    expect(screen.cwd()).toBe(subdir);

    app.destroy();
    rmSync(root, { recursive: true, force: true });
  });
});
