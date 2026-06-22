const ENTER = "\x1b[?1049h";
const EXIT = "\x1b[?1049l";

let entered = false;
let restored = false;

function restore(): void {
  if (restored) return;
  restored = true;
  if (entered) process.stdout.write(EXIT);
}

/**
 * Switch the terminal into the alternate screen buffer. The original screen
 * and scrollback are restored on any normal exit, SIGINT, or SIGTERM. No-op
 * when stdout isn't a TTY (piped output, tests).
 */
export function enterAlternateScreen(): void {
  if (process.stdout.isTTY !== true) return;
  if (entered) return;
  entered = true;

  process.stdout.write(ENTER);
  process.on("exit", restore);
  process.on("SIGINT", () => {
    restore();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    restore();
    process.exit(143);
  });
}

/**
 * Explicit early restore so caller can print to the normal screen (e.g. a
 * final summary line that should persist in scrollback after the TUI
 * unmounts). Safe to call multiple times — the exit handler will not
 * double-write.
 */
export function exitAlternateScreen(): void {
  restore();
}
