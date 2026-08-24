import { describe, expect, it } from "vitest";
import type { FileResult } from "../state";
import { renderView } from "../testHarness";
import { createSummaryScreen } from "../screens/summary";

const results: FileResult[] = [
  {
    file: "./data/demo.json",
    stationId: "CS_TEST_1",
    sessions: [
      {
        index: 0,
        status: "done",
        connectorId: "1",
        idTag: "RFID_TEST_1",
        txId: 10,
      },
      {
        index: 1,
        status: "rejected",
        connectorId: "1",
        idTag: "RFID_TEST_1",
        reason: "id_tag_not_accepted",
      },
    ],
    summary: undefined,
  },
];

const props = (over = {}) => ({
  fileResults: results,
  files: [{ path: "./data/demo.json", status: "done" as const }],
  width: 80,
  height: 14,
  ...over,
});

describe("summary screen", () => {
  it("shows the banner, per-file header and session breakdown", async () => {
    const h = await renderView(createSummaryScreen, props(), {
      width: 80,
      height: 14,
    });
    const frame = await h.frame();
    expect(frame).toContain("PASS");
    expect(frame).toContain("demo.json");
    expect(frame).toContain("s000");
    expect(frame).toContain("id_tag_not_accepted");
    h.destroy();
  });

  it("shows the pass/fail banner with batch totals", async () => {
    const h = await renderView(createSummaryScreen, props(), {
      width: 80,
      height: 14,
    });
    const frame = await h.frame();
    expect(frame).toContain("PASS");
    expect(frame).toContain("1 done");
    expect(frame).toContain("1 rejected");
    h.destroy();
  });

  it("renders dividers without a truncation ellipsis", async () => {
    const h = await renderView(createSummaryScreen, props(), {
      width: 80,
      height: 14,
    });
    expect(await h.frame()).not.toContain("...");
    h.destroy();
  });

  it("scrolls without going past the ends", async () => {
    const many: FileResult[] = [
      {
        file: "./data/big.json",
        stationId: "CS_TEST_1",
        sessions: Array.from({ length: 60 }, (_, i) => ({
          index: i,
          status: "done" as const,
          connectorId: "1",
          idTag: "RFID_TEST_1",
          txId: i,
        })),
        summary: undefined,
      },
    ];
    const h = await renderView(
      createSummaryScreen,
      props({ fileResults: many }),
      { width: 80, height: 14 },
    );
    expect(await h.frame()).toContain("s000");

    h.view.scrollPage(1);
    expect(await h.frame()).not.toContain("s000");

    // Scrolling back past the top must clamp, not underflow.
    h.view.scrollPage(-99);
    expect(await h.frame()).toContain("s000");
    h.destroy();
  });
});
