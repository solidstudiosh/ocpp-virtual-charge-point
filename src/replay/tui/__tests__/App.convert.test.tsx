import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";

function flush() {
  return new Promise((r) => setTimeout(r, 25));
}

const ESC = "";

const RAW_LOG = JSON.stringify([
  {
    timestamp: "2026-06-03T07:52:23+02:00",
    payload: JSON.stringify([
      2,
      "2",
      "StopTransaction",
      { idTag: "RFID_TEST_1", meterStop: 5, transactionId: 1 },
    ]),
  },
  {
    timestamp: "2026-06-03T07:52:19+02:00",
    payload: JSON.stringify([
      2,
      "1",
      "StartTransaction",
      { connectorId: 2, idTag: "RFID_TEST_1", meterStart: 0 },
    ]),
  },
]);

const NO_SESSION_LOG = JSON.stringify([
  {
    timestamp: "2026-06-03T07:52:19+02:00",
    payload: JSON.stringify([
      2,
      "1",
      "StatusNotification",
      { connectorId: 2, errorCode: "NoError", status: "Available" },
    ]),
  },
]);

const SCENARIO = JSON.stringify({ stationId: "CS_TEST_1", sessions: [] });

function setup(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "app-convert-test-"));
  for (const [name, text] of Object.entries(files)) {
    writeFileSync(join(dir, name), text);
  }
  const onBegin = vi.fn<(files: string[], idTag?: string) => void>();
  const utils = render(
    <App
      endpoint="ws://localhost:3000"
      initialFiles={[]}
      cwd={dir}
      onReady={() => {}}
      onBegin={onBegin}
    />,
  );
  return { dir, onBegin, ...utils };
}

describe("App convert-on-confirm flow", () => {
  it("routes raw logs through the wizard, writes output, swaps the path", async () => {
    const { dir, onBegin, lastFrame, stdin } = setup({
      "a.json": SCENARIO,
      "raw_ocpp_logs.json": RAW_LOG,
    });
    await flush();
    stdin.write("a"); // select all .json here
    await flush();
    stdin.write("B"); // begin → classification → wizard
    await flush();
    expect(lastFrame()).toContain("CONVERT");
    expect(lastFrame()).toContain("file 1/1");
    expect(lastFrame()).toContain("[raw]"); // stationId prefill, suffix stripped
    stdin.write("\r"); // accept defaults
    await flush();
    const outPath = join(dir, "raw_scenario.json");
    expect(existsSync(outPath)).toBe(true);
    const written = JSON.parse(readFileSync(outPath, "utf8"));
    expect(written.stationId).toBe("raw");
    expect(written.sessions).toHaveLength(1);
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(onBegin.mock.calls[0][0]).toEqual([join(dir, "a.json"), outPath]);
  });

  it("esc in the wizard returns to selection with picks intact", async () => {
    const { onBegin, lastFrame, stdin } = setup({
      "a.json": SCENARIO,
      "raw_ocpp_logs.json": RAW_LOG,
    });
    await flush();
    stdin.write("a");
    await flush();
    stdin.write("B");
    await flush();
    expect(lastFrame()).toContain("CONVERT");
    stdin.write(ESC); // esc
    await flush();
    expect(lastFrame()).toContain("SELECT FILES");
    expect(lastFrame()).toContain("2 selected");
    expect(onBegin).not.toHaveBeenCalled();
  });

  it("drops a zero-session raw log and begins with the rest", async () => {
    const { dir, onBegin, lastFrame, stdin } = setup({
      "a.json": SCENARIO,
      "empty_ocpp_logs.json": NO_SESSION_LOG,
    });
    await flush();
    stdin.write("a");
    await flush();
    stdin.write("B");
    await flush();
    expect(lastFrame()).toContain("no replayable sessions");
    stdin.write("\r"); // continue → drop the file
    await flush();
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(onBegin.mock.calls[0][0]).toEqual([join(dir, "a.json")]);
    expect(existsSync(join(dir, "empty_scenario.json"))).toBe(false);
  });

  it("starts immediately when no raw logs are selected", async () => {
    const { dir, onBegin, stdin } = setup({ "a.json": SCENARIO });
    await flush();
    stdin.write("a");
    await flush();
    stdin.write("B");
    await flush();
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(onBegin.mock.calls[0][0]).toEqual([join(dir, "a.json")]);
  });

  it("advances through a multi-file wizard queue, swapping each path", async () => {
    const { dir, onBegin, lastFrame, stdin } = setup({
      "r1_ocpp_logs.json": RAW_LOG,
      "r2_ocpp_logs.json": RAW_LOG,
    });
    await flush();
    stdin.write("a"); // select both raw logs
    await flush();
    stdin.write("B");
    await flush();
    expect(lastFrame()).toContain("file 1/2");
    expect(lastFrame()).toContain("[r1]");
    stdin.write("\r"); // accept file 1 → advance to file 2
    await flush();
    expect(lastFrame()).toContain("file 2/2");
    expect(lastFrame()).toContain("[r2]");
    stdin.write("\r"); // accept file 2 → begin run
    await flush();
    const out1 = join(dir, "r1_scenario.json");
    const out2 = join(dir, "r2_scenario.json");
    expect(existsSync(out1)).toBe(true);
    expect(existsSync(out2)).toBe(true);
    expect(onBegin).toHaveBeenCalledTimes(1);
    expect(onBegin.mock.calls[0][0]).toEqual([out1, out2]);
  });
});

describe("App convert-only (v) flow", () => {
  it("converts selected raw logs and returns to selection without running", async () => {
    const { dir, onBegin, lastFrame, stdin } = setup({
      "raw_ocpp_logs.json": RAW_LOG,
    });
    await flush();
    stdin.write("a"); // select the raw log
    await flush();
    stdin.write("v"); // convert-only
    await flush();
    expect(lastFrame()).toContain("CONVERT");
    stdin.write("\r"); // accept defaults
    await flush();
    const outPath = join(dir, "raw_scenario.json");
    expect(existsSync(outPath)).toBe(true);
    // Back on the selection screen — never ran — with the output selected.
    expect(lastFrame()).toContain("SELECT FILES");
    expect(lastFrame()).toContain("1 selected");
    expect(onBegin).not.toHaveBeenCalled();
  });

  it("is a no-op when the selection holds no raw logs", async () => {
    const { onBegin, lastFrame, stdin } = setup({ "a.json": SCENARIO });
    await flush();
    stdin.write("a");
    await flush();
    stdin.write("v");
    await flush();
    expect(lastFrame()).toContain("SELECT FILES"); // no wizard opened
    expect(lastFrame()).not.toContain("CONVERT");
    expect(onBegin).not.toHaveBeenCalled();
  });
});
