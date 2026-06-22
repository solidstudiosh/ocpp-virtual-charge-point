export interface ReplayController {
  readonly paused: boolean;
  readonly stopRequested: boolean;
  readonly abortRequested: boolean;
  pause(): void;
  resume(): void;
  togglePause(): void;
  requestStop(): void;
  requestAbort(): void;
  /** Clear pause/stop/abort for a fresh round; releases any pause gate. */
  reset(): void;
  consumeStop(): boolean;
  waitWhilePaused(): Promise<void>;
}

export function createReplayController(): ReplayController {
  let paused = false;
  let stopRequested = false;
  let abortRequested = false;
  let gateResolve: (() => void) | undefined;
  let gate: Promise<void> | undefined;

  const openGate = () => {
    if (gateResolve) {
      gateResolve();
      gateResolve = undefined;
      gate = undefined;
    }
  };

  return {
    get paused() {
      return paused;
    },
    get stopRequested() {
      return stopRequested;
    },
    get abortRequested() {
      return abortRequested;
    },
    pause() {
      if (paused) return;
      paused = true;
      gate = new Promise<void>((resolve) => {
        gateResolve = resolve;
      });
    },
    resume() {
      if (!paused) return;
      paused = false;
      openGate();
    },
    togglePause() {
      if (paused) this.resume();
      else this.pause();
    },
    requestStop() {
      stopRequested = true;
      openGate();
    },
    requestAbort() {
      abortRequested = true;
      openGate();
    },
    reset() {
      paused = false;
      stopRequested = false;
      abortRequested = false;
      openGate();
    },
    consumeStop() {
      const was = stopRequested;
      stopRequested = false;
      return was;
    },
    waitWhilePaused() {
      if (!paused) return Promise.resolve();
      return gate ?? Promise.resolve();
    },
  };
}
