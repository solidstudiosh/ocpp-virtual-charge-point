import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildConvertQueue,
  defaultStationId,
  isRawLogFile,
  rawLogWarnings,
  readRawLogEntries,
  scenarioOutputPath,
} from "../convertQueue";

const RAW = JSON.stringify([
  {
    timestamp: "2026-06-03T07:52:17+02:00",
    payload: JSON.stringify([2, "1", "Heartbeat", {}]),
  },
]);
const SCENARIO = JSON.stringify({ stationId: "CS_TEST_1", sessions: [] });

function readerFor(map: Record<string, string>) {
  return (p: string): string => {
    const text = map[p];
    if (text === undefined) throw new Error(`ENOENT: ${p}`);
    return text;
  };
}

describe("defaultStationId / scenarioOutputPath", () => {
  it("strips .json and a trailing _ocpp_logs suffix", () => {
    const p = join("data", "abc-123_ocpp_logs.json");
    expect(defaultStationId(p)).toBe("abc-123");
    expect(scenarioOutputPath(p)).toBe(join("data", "abc-123_scenario.json"));
  });

  it("uses the plain stem when there is no suffix", () => {
    const p = join("data", "mylog.json");
    expect(defaultStationId(p)).toBe("mylog");
    expect(scenarioOutputPath(p)).toBe(join("data", "mylog_scenario.json"));
  });
});

describe("isRawLogFile", () => {
  it("is true for raw logs, false for scenarios, garbage, missing", () => {
    const read = readerFor({
      "/a.json": RAW,
      "/b.json": SCENARIO,
      "/c.json": "{nope",
    });
    expect(isRawLogFile("/a.json", read)).toBe(true);
    expect(isRawLogFile("/b.json", read)).toBe(false);
    expect(isRawLogFile("/c.json", read)).toBe(false);
    expect(isRawLogFile("/missing.json", read)).toBe(false);
  });
});

describe("buildConvertQueue", () => {
  it("queues only raw-log files, with derived names", () => {
    const raw = join("/d", "x_ocpp_logs.json");
    const scen = join("/d", "y.json");
    const read = readerFor({ [raw]: RAW, [scen]: SCENARIO });
    const queue = buildConvertQueue([scen, raw], read);
    expect(queue).toEqual([
      {
        sourcePath: raw,
        outputPath: join("/d", "x_scenario.json"),
        defaultStationId: "x",
      },
    ]);
  });
});

describe("readRawLogEntries", () => {
  it("returns entries for raw logs, undefined otherwise", () => {
    const read = readerFor({ "/a.json": RAW, "/b.json": SCENARIO });
    expect(readRawLogEntries("/a.json", read)).toHaveLength(1);
    expect(readRawLogEntries("/b.json", read)).toBeUndefined();
    expect(readRawLogEntries("/missing.json", read)).toBeUndefined();
  });
});

describe("rawLogWarnings", () => {
  it("emits one warning per raw-log path", () => {
    const read = readerFor({ "/a.json": RAW, "/b.json": SCENARIO });
    const warnings = rawLogWarnings(["/a.json", "/b.json"], read);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("/a.json");
    expect(warnings[0]).toContain("convert");
  });
});
