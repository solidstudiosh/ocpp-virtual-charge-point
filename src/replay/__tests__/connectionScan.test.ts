import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveFileConnectionForDisplay } from "../connection";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "replay-scan-"));
});

function writeFile(name: string, contents: unknown): string {
  const path = join(dir, name);
  writeFileSync(
    path,
    typeof contents === "string" ? contents : JSON.stringify(contents),
    "utf8",
  );
  return path;
}

describe("resolveFileConnectionForDisplay", () => {
  it("reads the file stationId and reports file-sourced auth", () => {
    const path = writeFile("a.json", {
      stationId: "CS_1",
      password: "pw",
      sessions: [],
    });
    const r = resolveFileConnectionForDisplay(path, {});
    expect(r.cpId).toBe("CS_1");
    expect(r.authSource).toBe("file");
  });

  it("reports env auth when the file has no password but env does", () => {
    const path = writeFile("b.json", { stationId: "CS_2", sessions: [] });
    const r = resolveFileConnectionForDisplay(path, {
      passwordDefault: "envpw",
    });
    expect(r.cpId).toBe("CS_2");
    expect(r.authSource).toBe("env");
  });

  it("does not expose the password value", () => {
    const path = writeFile("c.json", {
      stationId: "CS_3",
      password: "secret",
      sessions: [],
    });
    const r = resolveFileConnectionForDisplay(path, {});
    expect(JSON.stringify(r)).not.toContain("secret");
  });

  it("tolerates an unreadable file and falls back to forced/default values", () => {
    const r = resolveFileConnectionForDisplay(join(dir, "missing.json"), {
      cpIdDefault: "ENV_ID",
    });
    expect(r.cpId).toBe("ENV_ID");
  });

  it("lets a CLI force id win over the file", () => {
    const path = writeFile("d.json", { stationId: "CS_4", sessions: [] });
    const r = resolveFileConnectionForDisplay(path, { cpIdForce: "FORCED" });
    expect(r.cpId).toBe("FORCED");
  });
});
