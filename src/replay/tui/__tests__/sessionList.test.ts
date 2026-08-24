import { describe, expect, it } from "vitest";
import type { SessionRow } from "../state";
import { renderView } from "../testHarness";
import {
  createSessionList,
  formatSessionRow,
  windowStart,
} from "../widgets/sessionList";

const row = (index: number, over: Partial<SessionRow> = {}): SessionRow => ({
  index,
  status: "pending",
  connectorId: "1",
  idTag: "RFID_TEST_1",
  ...over,
});

describe("SessionList", () => {
  it("formats a row with connector, idTag and tx", () => {
    const line = formatSessionRow(row(2, { status: "done", txId: 77 }));
    expect(line).toContain("#  2");
    expect(line).toContain("cid=1");
    expect(line).toContain("idTag=RFID_TEST_1");
    expect(line).toContain("tx=77");
  });

  it("appends the rejection reason only when rejected", () => {
    const rejected = formatSessionRow(
      row(1, { status: "rejected", reason: "id_tag_not_accepted" }),
    );
    expect(rejected).toContain("reason=id_tag_not_accepted");
    expect(formatSessionRow(row(1, { status: "done" }))).not.toContain(
      "reason=",
    );
  });

  it("windows around the running session", async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => row(i));
    sessions[15].status = "running";
    const h = await renderView(
      createSessionList,
      { sessions, rows: 4 },
      { width: 60, height: 5 },
    );
    const frame = await h.frame();
    expect(frame).toContain("# 15");
    expect(frame).not.toContain("#  0");
    h.destroy();
  });

  it("slides the window as the running session advances", async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => row(i));
    sessions[2].status = "running";
    const h = await renderView(
      createSessionList,
      { sessions, rows: 4 },
      { width: 60, height: 5 },
    );

    const before = await h.frame();
    expect(before).toContain("#  2");
    expect(before).not.toContain("# 15");

    const advanced = sessions.map((s, i): SessionRow => {
      if (i === 2) return { ...s, status: "done" };
      if (i === 15) return { ...s, status: "running" };
      return s;
    });
    h.view.update({ sessions: advanced, rows: 4 });

    const after = await h.frame();
    expect(after).toContain("# 15");
    expect(after).not.toContain("#  2");
    h.destroy();
  });

  it("recycles row renderables instead of rebuilding them", async () => {
    const sessions = Array.from({ length: 3 }, (_, i) => row(i));
    const h = await renderView(
      createSessionList,
      { sessions, rows: 3 },
      { width: 60, height: 5 },
    );
    await h.frame();
    const firstRow = h.view.root.getChildren()[0];
    const secondRow = h.view.root.getChildren()[1];

    h.view.update({
      sessions: [row(0), row(1, { status: "done", txId: 5 }), row(2)],
      rows: 3,
    });
    await h.frame();

    expect(h.view.root.getChildren()[0]).toBe(firstRow);
    expect(h.view.root.getChildren()[1]).toBe(secondRow);
    h.destroy();
  });

  it("hides surplus rows when the session list shrinks", async () => {
    const sessions = Array.from({ length: 6 }, (_, i) => row(i));
    const h = await renderView(
      createSessionList,
      { sessions, rows: 6 },
      { width: 60, height: 8 },
    );
    expect(await h.frame()).toContain("#  5");

    h.view.update({ sessions: sessions.slice(0, 2), rows: 6 });
    const after = await h.frame();
    expect(after).toContain("#  1");
    expect(after).not.toContain("#  5");
    h.destroy();
  });

  it("hides pooled rows when the row budget shrinks", async () => {
    const sessions = Array.from({ length: 8 }, (_, i) => row(i));
    sessions[0].status = "running";
    const h = await renderView(
      createSessionList,
      { sessions, rows: 8 },
      { width: 60, height: 10 },
    );
    expect(await h.frame()).toContain("#  7");

    h.view.update({ sessions, rows: 3 });
    const after = await h.frame();
    expect(after).not.toContain("#  7");
    h.destroy();
  });
});

describe("windowStart", () => {
  it("returns 0 when the list fits the budget", () => {
    expect(windowStart(3, 5, 1)).toBe(0);
    expect(windowStart(5, 5, 4)).toBe(0);
  });

  it("never returns a negative start when the running session is at the top", () => {
    expect(windowStart(20, 4, 0)).toBe(0);
  });

  it("clamps to the end when the running session is last", () => {
    // start must leave a full budget of rows: 20 - 4 = 16
    expect(windowStart(20, 4, 19)).toBe(16);
  });

  it("shows the tail when no session is running", () => {
    expect(windowStart(20, 4, -1)).toBe(16);
  });
});
