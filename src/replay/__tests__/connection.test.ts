import { describe, expect, it } from "vitest";
import { resolveConnection } from "../connection";

describe("resolveConnection — cpId precedence", () => {
  it("uses the file stationId over the env default", () => {
    const r = resolveConnection(
      { stationId: "FILE_ID" },
      { cpIdDefault: "ENV_ID" },
    );
    expect(r.cpId).toBe("FILE_ID");
  });

  it("lets a CLI force value override the file stationId", () => {
    const r = resolveConnection(
      { stationId: "FILE_ID" },
      { cpIdForce: "CLI_ID", cpIdDefault: "ENV_ID" },
    );
    expect(r.cpId).toBe("CLI_ID");
  });

  it("falls back to the env default when the file has no stationId", () => {
    const r = resolveConnection({}, { cpIdDefault: "ENV_ID" });
    expect(r.cpId).toBe("ENV_ID");
  });

  it("is undefined when no source provides an id", () => {
    const r = resolveConnection({}, {});
    expect(r.cpId).toBeUndefined();
  });

  it("ignores empty-string inputs", () => {
    const r = resolveConnection(
      { stationId: "  " },
      { cpIdForce: "", cpIdDefault: "ENV_ID" },
    );
    expect(r.cpId).toBe("ENV_ID");
  });
});

describe("resolveConnection — password precedence & authSource", () => {
  it("uses the file password over the env default and marks it as file", () => {
    const r = resolveConnection(
      { stationId: "X", password: "filepw" },
      { passwordDefault: "envpw" },
    );
    expect(r.password).toBe("filepw");
    expect(r.authSource).toBe("file");
  });

  it("lets a CLI force password override the file and marks it as cli", () => {
    const r = resolveConnection(
      { stationId: "X", password: "filepw" },
      { passwordForce: "clipw", passwordDefault: "envpw" },
    );
    expect(r.password).toBe("clipw");
    expect(r.authSource).toBe("cli");
  });

  it("falls back to the env password and marks it as env", () => {
    const r = resolveConnection(
      { stationId: "X" },
      { passwordDefault: "envpw" },
    );
    expect(r.password).toBe("envpw");
    expect(r.authSource).toBe("env");
  });

  it("reports authSource none with no password anywhere", () => {
    const r = resolveConnection({ stationId: "X" }, {});
    expect(r.password).toBeUndefined();
    expect(r.authSource).toBe("none");
  });

  it("treats an empty-string file password as no auth", () => {
    const r = resolveConnection({ stationId: "X", password: "" }, {});
    expect(r.password).toBeUndefined();
    expect(r.authSource).toBe("none");
  });
});
