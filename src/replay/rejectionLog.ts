import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RejectionRecord } from "./types";

export class RejectionLog {
  constructor(private path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }
  append(record: RejectionRecord): void {
    appendFileSync(this.path, `${JSON.stringify(record)}\n`, "utf8");
  }
}
