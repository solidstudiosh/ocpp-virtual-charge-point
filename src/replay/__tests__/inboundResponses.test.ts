import { describe, expect, it } from "vitest";
import { rejectionResponseFor } from "../inboundResponses";

describe("rejectionResponseFor", () => {
  it("rejects RemoteStartTransaction", () => {
    expect(rejectionResponseFor("RemoteStartTransaction")).toEqual({
      status: "Rejected",
    });
  });
  it("rejects ChangeConfiguration", () => {
    expect(rejectionResponseFor("ChangeConfiguration")).toEqual({
      status: "Rejected",
    });
  });
  it("returns NotImplemented for TriggerMessage", () => {
    expect(rejectionResponseFor("TriggerMessage")).toEqual({
      status: "NotImplemented",
    });
  });
  it("returns empty arrays for GetConfiguration", () => {
    expect(rejectionResponseFor("GetConfiguration")).toEqual({
      configurationKey: [],
      unknownKey: [],
    });
  });
  it("returns Rejected for DataTransfer", () => {
    expect(rejectionResponseFor("DataTransfer")).toEqual({
      status: "Rejected",
    });
  });
  it("returns null for unknown action", () => {
    expect(rejectionResponseFor("BogusAction")).toBeNull();
  });
});
