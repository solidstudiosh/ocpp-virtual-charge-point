import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RunSummary } from "./types";

export class RunLog {
  constructor(private path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }
  append(summary: RunSummary): void {
    appendFileSync(this.path, `${JSON.stringify(summary)}\n`, "utf8");
  }
}
