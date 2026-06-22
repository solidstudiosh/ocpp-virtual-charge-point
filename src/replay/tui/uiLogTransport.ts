import Transport from "winston-transport";
import type { ReplayEventEmitter } from "../events";

export class UiLogTransport extends Transport {
  private readonly dispatch: ReplayEventEmitter;
  constructor(dispatch: ReplayEventEmitter) {
    super({ level: "debug" });
    this.dispatch = dispatch;
  }
  log(info: { level: string; message: unknown }, next: () => void): void {
    this.dispatch({
      type: "log",
      ts: new Date().toISOString(),
      level: info.level,
      message: String(info.message),
    });
    next();
  }
}
