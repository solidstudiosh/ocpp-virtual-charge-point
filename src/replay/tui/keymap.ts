/**
 * Keybindings as data.
 *
 * This table is the single source of truth for both dispatch and the help
 * text. Under Ink these were two separate things — `useInput` blocks and a
 * hardcoded `shortKeys()` string — which could drift apart silently. Adding a
 * key here makes it work *and* documents it.
 */

export type Phase = "selecting" | "converting" | "running" | "complete";

/** State the `when` guards are evaluated against. */
export interface KeyContext {
  canBegin: boolean;
}

export interface Binding {
  phase: Phase;
  /** ParsedKey names that trigger this binding. */
  keys: string[];
  /** Glyph shown in the help line, e.g. "↑↓" or "B". */
  hint: string;
  /** Verb shown in the help line. */
  label: string;
  /** Action id handed to the screen. Unique within a phase. */
  action: string;
  /** When present and false, the binding is inert and hidden from help. */
  when?: (ctx: KeyContext) => boolean;
}

const canBegin = (ctx: KeyContext) => ctx.canBegin;

export const BINDINGS: Binding[] = [
  // --- selecting (the `ready` screen is merged into this phase) ---
  {
    phase: "selecting",
    keys: ["up", "down"],
    hint: "↑↓",
    label: "move",
    action: "move",
  },
  {
    phase: "selecting",
    keys: ["pageup", "pagedown"],
    hint: "PgUp/PgDn",
    label: "page",
    action: "page",
  },
  {
    phase: "selecting",
    keys: ["return"],
    hint: "Enter",
    label: "open",
    action: "open",
  },
  {
    phase: "selecting",
    keys: ["space"],
    hint: "Space",
    label: "toggle",
    action: "toggle",
  },
  {
    phase: "selecting",
    keys: ["u", "left", "backspace"],
    hint: "u",
    label: "up",
    action: "up",
  },
  {
    phase: "selecting",
    keys: ["a"],
    hint: "a",
    label: "all",
    action: "selectAll",
  },
  {
    phase: "selecting",
    keys: ["c"],
    hint: "c",
    label: "clear",
    action: "clear",
  },
  {
    phase: "selecting",
    keys: ["v"],
    hint: "v",
    label: "convert",
    action: "convert",
    when: canBegin,
  },
  {
    phase: "selecting",
    keys: ["t"],
    hint: "t",
    label: "idTag",
    action: "editIdTag",
  },
  {
    phase: "selecting",
    keys: ["B", "b"],
    hint: "B",
    label: "begin",
    action: "begin",
    when: canBegin,
  },
  {
    phase: "selecting",
    keys: ["q"],
    hint: "q",
    label: "quit",
    action: "quit",
  },

  // --- converting ---
  {
    phase: "converting",
    keys: ["up", "down"],
    hint: "↑↓",
    label: "field",
    action: "field",
  },
  {
    phase: "converting",
    keys: ["return"],
    hint: "Enter",
    label: "accept",
    action: "accept",
  },
  {
    phase: "converting",
    keys: ["escape"],
    hint: "Esc",
    label: "cancel",
    action: "cancel",
  },

  // --- running ---
  {
    phase: "running",
    keys: ["s"],
    hint: "s",
    label: "stop-now",
    action: "stop",
  },
  {
    phase: "running",
    keys: ["p"],
    hint: "p",
    label: "pause",
    action: "pause",
  },
  {
    phase: "running",
    keys: ["a"],
    hint: "a",
    label: "abort",
    action: "abort",
  },
  {
    phase: "running",
    keys: ["l", "L"],
    hint: "l",
    label: "file-log",
    action: "toggleFileLog",
  },
  {
    phase: "running",
    keys: ["?"],
    hint: "?",
    label: "help",
    action: "toggleHelp",
  },

  // --- complete ---
  {
    phase: "complete",
    keys: ["up", "down"],
    hint: "↑↓",
    label: "scroll",
    action: "scroll",
  },
  {
    phase: "complete",
    keys: ["pageup", "pagedown"],
    hint: "PgUp/PgDn",
    label: "page",
    action: "scrollPage",
  },
  {
    phase: "complete",
    keys: ["f"],
    hint: "f",
    label: "file selection",
    action: "again",
  },
  {
    phase: "complete",
    keys: ["q", "return"],
    hint: "q",
    label: "quit",
    action: "quit",
  },
];

/** Bindings active for a phase, honouring `when` guards. */
export function activeBindings(phase: Phase, ctx: KeyContext): Binding[] {
  return BINDINGS.filter(
    (b) => b.phase === phase && (b.when === undefined || b.when(ctx)),
  );
}

/** The footer hint line, derived from the same table that dispatches. */
export function helpLine(phase: Phase, ctx: KeyContext): string {
  return activeBindings(phase, ctx)
    .map((b) => `[${b.hint}] ${b.label}`)
    .join("  ");
}

/** Expanded per-key help for the running phase, shown when `?` is toggled. */
export const HELP_DETAILS: string[] = [
  "s — stop the current session now (synthetic StopTransaction with last MeterValues)",
  "p — pause/resume between messages; the in-flight message completes first",
  "a — abort after truncating the current session; remaining files skipped (exit 4)",
  "l — toggle writing each session's logs under ./data/replay-session-logs",
  "? — toggle this help panel",
];

/** Minimal shape of a key event; matches Core's ParsedKey. */
export interface KeyLike {
  name: string;
}

export interface KeyRouter {
  /** Returns true when the key matched a binding and was dispatched. */
  handle(key: KeyLike): boolean;
}

export function createKeyRouter(opts: {
  getPhase: () => Phase;
  getContext: () => KeyContext;
  onAction: (action: string) => void;
}): KeyRouter {
  return {
    handle(key) {
      const phase = opts.getPhase();
      const ctx = opts.getContext();
      const hit = activeBindings(phase, ctx).find((b) =>
        b.keys.includes(key.name),
      );
      if (hit === undefined) return false;
      opts.onAction(hit.action);
      return true;
    },
  };
}
