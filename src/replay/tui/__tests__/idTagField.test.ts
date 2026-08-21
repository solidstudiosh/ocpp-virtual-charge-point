import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import type { IdTagFieldView } from "../widgets/idTagField";
import { createIdTagField } from "../widgets/idTagField";

describe("IdTagField", () => {
  it("shows (none) when unset and not editing", async () => {
    const h = await renderView(
      createIdTagField,
      { value: "", editing: false },
      { width: 50, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).toContain("idTag");
    expect(frame).toContain("(none)");
    expect(frame).toContain("[t] edit");
    h.destroy();
  });

  it("shows the committed value when unset to a real tag", async () => {
    const h = await renderView(
      createIdTagField,
      { value: "RFID_TEST_1", editing: false },
      { width: 50, height: 2 },
    );
    expect(await h.frame()).toContain("RFID_TEST_1");
    h.destroy();
  });

  it("swaps to the editor and shows the key hints while editing", async () => {
    const h = await renderView(
      createIdTagField,
      { value: "RFID_TEST_1", editing: false },
      { width: 50, height: 2 },
    );
    h.view.update({ value: "RFID_TEST_1", editing: true });
    const frame = await h.frame();
    expect(frame).toContain("Enter confirm");
    expect(frame).toContain("Esc cancel");
    expect(frame).not.toContain("[t] edit");
    h.destroy();
  });

  it("value() reads back the committed text (round-trip)", async () => {
    const h = await renderView(
      createIdTagField,
      { value: "RFID_TEST_1", editing: false },
      { width: 50, height: 2 },
    );
    expect((h.view as IdTagFieldView).value()).toBe("RFID_TEST_1");
    h.destroy();
  });

  it("re-seeds the editor from the committed value, discarding a stale draft", async () => {
    // Start already editing, with a draft the user hasn't committed yet.
    const h = await renderView(
      createIdTagField,
      { value: "STALE_DRAFT", editing: true },
      { width: 50, height: 2 },
    );
    const view = h.view as IdTagFieldView;
    expect(view.value()).toBe("STALE_DRAFT");

    // Committing a new value while leaving edit mode must overwrite the
    // draft, not merge with it.
    view.update({ value: "RFID_TEST_1", editing: false });
    expect(view.value()).toBe("RFID_TEST_1");

    // Re-entering edit mode must start from the committed value, not the
    // stale draft that was sitting in the input before the commit.
    view.update({ value: "RFID_TEST_1", editing: true });
    expect(view.value()).toBe("RFID_TEST_1");
    h.destroy();
  });
});
