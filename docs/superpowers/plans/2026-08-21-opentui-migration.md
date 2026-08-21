# Replay TUI: Ink → OpenTUI Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ink/React with imperative `@opentui/core` as the rendering layer for the OCPP 1.6 replay TUI, removing React from the repository entirely.

**Architecture:** Every widget and screen is a factory returning a `View<P>` — `{ root, update(props), destroy() }` — whose renderables are constructed once and thereafter only mutated. A `ScreenRouter` keeps exactly one screen alive; a `KeyRouter` dispatches from a keybinding table that also generates the help text. The pure state layer (`state.ts`, `batchLoop.ts`, `convertQueue.ts`, `format.ts`) is untouched.

**Tech Stack:** TypeScript, `@opentui/core` 0.5.6 (pinned exactly), Node 26.x with `--experimental-ffi`, tsx, vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-08-21-opentui-migration-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Node-only.** No Bun. No `bun run` in any script this plan touches.
- **`@opentui/core` is pinned exactly to `"0.5.6"`** — no caret, no tilde. Upstream runs no Node CI lane; a patch release could change FFI loading.
- **`--experimental-ffi` is mandatory.** Without it Core throws `OpenTUI native FFI is not available for this runtime yet`. Delivered via `NODE_OPTIONS`.
- **No React, no Solid, no JSX.** All files under `src/replay/tui/` are `.ts`, never `.tsx`.
- **Capability parity is the acceptance gate** — the checklist in the spec's "Capability inventory" section. A task is not done if it drops a listed capability.
- **Public repo — no client data.** Use `CS_TEST_1` for station ids, `RFID_TEST_1` for idTags, `VCP-Replay` for vendor strings. Never a real-looking identifier, in source, tests, or fixtures.
- **Biome formatting:** 2-space indent, 80-column width, double quotes, trailing commas. Run `npm run check` before every commit.
- **The `AppController` interface shape must not change** — `index_replay_16_tui.ts` and `batchLoop.ts` depend on it.

## Verified API reference

These were confirmed empirically against `@opentui/core@0.5.6` on Node 26.1.0. Use them exactly; do not guess alternatives.

```ts
// Construction — the renderer doubles as the RenderContext.
// GOTCHA (verified): BoxRenderable defaults to flexDirection "column", NOT
// "row" as CSS flexbox does. Any box whose children sit side by side MUST
// pass flexDirection: "row" explicitly, or they stack vertically.
new BoxRenderable(ctx, { id, width, height, border, borderColor,
                         flexDirection, paddingLeft, flexGrow, flexShrink })
new TextRenderable(ctx, { id, content, fg, bg, attributes,
                          wrapMode: "none" | "char" | "word", truncate: boolean })
new ScrollBoxRenderable(ctx, { id, height, stickyScroll, stickyStart: "bottom",
                               scrollY, viewportCulling })
parent.add(child)               // attach
text.content = "new value"      // mutate; core dirty-tracks natively

// Keyboard — ParsedKey fields: name, ctrl, meta, shift, option, sequence, raw
renderer.keyInput.on("keypress", (e) => { /* e.name === "p" | "up" | "return" */ })

// Test renderer
const { renderer, renderOnce, captureCharFrame, mockInput,
        waitForVisualIdle, flush, resize } = await createTestRenderer({ width, height })
mockInput.pressKey("p")
await waitForVisualIdle(); await renderOnce()
captureCharFrame()              // => string, the rendered char grid
```

**Ink → Core translation table:**

| Ink | Core |
|---|---|
| `<Text wrap="truncate-end">` | `{ wrapMode: "none", truncate: true }` |
| `<Text bold>` | `{ attributes: 1 }` |
| `<Text dimColor>` | dim token colour from `theme.ts` |
| `<Box borderStyle="round">` | `{ border: true }` |
| `useInput` | `renderer.keyInput.on("keypress", ...)` |
| `useStdout` + resize listener | renderer `RESIZE` event |
| `useApp().exit()` | `renderer.destroy()` + resolve the exit promise |
| alt-screen escape codes | `screenMode: "alternate-screen"` |
| `ink-testing-library` `lastFrame()` | `captureCharFrame()` |
| `flushFrames()` `setTimeout(10)` | `await waitForVisualIdle()` |

---

### Task 1: Runtime harness — dependencies, flags, smoke test

Establishes that Core boots on Node in this repo before any UI is written.

**Files:**
- Modify: `package.json`
- Create: `src/replay/tui/__tests__/runtime.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` that can render OpenTUI frames; the `NODE_OPTIONS=--experimental-ffi` convention every later task's tests rely on.

- [ ] **Step 1: Write the failing smoke test**

Create `src/replay/tui/__tests__/runtime.test.ts`:

```ts
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { describe, expect, it } from "vitest";

describe("opentui runtime", () => {
  it("renders a frame under Node with --experimental-ffi", async () => {
    const { renderer, renderOnce, captureCharFrame, waitForVisualIdle } =
      await createTestRenderer({ width: 24, height: 3 });
    const box = new BoxRenderable(renderer, {
      id: "smoke",
      width: 24,
      height: 3,
      border: true,
    });
    renderer.root.add(box);
    box.add(new TextRenderable(renderer, { id: "t", content: "ok" }));
    await waitForVisualIdle();
    await renderOnce();
    expect(captureCharFrame()).toContain("ok");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- runtime`
Expected: FAIL — `Cannot find package '@opentui/core'`.

- [ ] **Step 3: Swap the dependencies**

```bash
npm install --save-exact @opentui/core@0.5.6
```

**Do not uninstall `ink`, `react`, `@types/react` or `ink-testing-library` yet** (ruling R1). `App.tsx` and the existing Ink tests depend on them until Task 14, and removing them now breaks typecheck for twelve tasks. Task 16 removes them.

Verify `package.json` shows `"@opentui/core": "0.5.6"` with **no** caret. If npm wrote a caret, edit it to the bare version by hand.

- [ ] **Step 4: Add the FFI flag to the scripts**

In `package.json`, set these three scripts exactly:

```json
"replay:16:tui": "NODE_OPTIONS=--experimental-ffi tsx index_replay_16_tui.ts",
"replay:16:tui:pick": "NODE_OPTIONS=--experimental-ffi tsx index_replay_16_tui.ts --pick",
"test": "NODE_OPTIONS=--experimental-ffi vitest run",
"test:watch": "NODE_OPTIONS=--experimental-ffi vitest",
```

Leave `typecheck` alone for now — it must keep the `.tsx` glob and `--jsx react-jsx` while Ink files remain. Task 16 simplifies it.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- runtime`
Expected: PASS. A stderr line `"FFI is an experimental feature and might change at any time"` may appear — that is expected and is suppressed for the real app in Task 15.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/replay/tui/__tests__/runtime.test.ts
git commit -m "build(replay): swap ink/react for pinned @opentui/core 0.5.6"
```

---

### Task 2: The View contract and the test harness

The single convention that keeps imperative UI code from rotting.

**Files:**
- Create: `src/replay/tui/view.ts`
- Create: `src/replay/tui/testHarness.ts`
- Create: `src/replay/tui/__tests__/view.test.ts`

**Interfaces:**
- Consumes: Task 1's runtime.
- Produces: `View<P>`, `Factory<P>`, `mountAll`, `destroyAll` from `view.ts`; `renderView` from `testHarness.ts`. **Every later task uses both.**

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/view.test.ts`:

```ts
import { TextRenderable } from "@opentui/core";
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import type { View } from "../view";

function createLabel(ctx: RenderContext, initial: { text: string }): View<{
  text: string;
}> {
  const root = new TextRenderable(ctx, {
    id: "label",
    content: initial.text,
  });
  return {
    root,
    update(props) {
      root.content = props.text;
    },
    destroy() {
      root.destroyRecursively();
    },
  };
}

describe("View contract", () => {
  it("renders initial props and re-renders on update", async () => {
    const h = await renderView(createLabel, { text: "first" }, {
      width: 20,
      height: 2,
    });
    expect(await h.frame()).toContain("first");

    h.view.update({ text: "second" });
    const after = await h.frame();
    expect(after).toContain("second");
    expect(after).not.toContain("first");

    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- view`
Expected: FAIL — cannot resolve `../testHarness` or `../view`.

- [ ] **Step 3: Write `view.ts`**

Create `src/replay/tui/view.ts`:

```ts
import type { Renderable, RenderContext } from "@opentui/core";

/**
 * The contract every widget and screen implements.
 *
 * Renderables are constructed exactly once, inside the factory. `update` only
 * assigns to properties — Core dirty-tracks natively, so redundant assignment
 * is cheap and no conditional tree-building is ever needed. This is what keeps
 * imperative UI code from turning into ad-hoc mutation scattered across files.
 */
export interface View<P> {
  readonly root: Renderable;
  /** Idempotent. Assign to properties; never rebuild the tree. */
  update(props: P): void;
  /**
   * Free the whole subtree. Implementations MUST call
   * `root.destroyRecursively()`, never `root.destroy()` — Core's `destroy()`
   * only detaches direct children (`this.remove(child)`) and frees its own
   * Yoga node, so plain `destroy()` leaks every pooled row and every internal
   * box of a composite like `ScrollBoxRenderable`.
   */
  destroy(): void;
}

/** A widget or screen constructor. `ctx` is the renderer. */
export type Factory<P> = (ctx: RenderContext, initial: P) => View<P>;

/**
 * A view whose prop type is not known to the holder — for heterogeneous
 * collections like the ScreenRouter's "currently mounted screen".
 */
// biome-ignore lint/suspicious/noExplicitAny: intentionally prop-type-erased
export type AnyView = View<any>;

/** Attach every view's root to `parent`, in order. */
export function mountAll(parent: Renderable, views: AnyView[]): void {
  for (const v of views) parent.add(v.root);
}

/** Destroy every view, tolerating already-destroyed children. */
export function destroyAll(views: AnyView[]): void {
  for (const v of views) v.destroy();
}
```

- [ ] **Step 4: Write `testHarness.ts`**

Create `src/replay/tui/testHarness.ts`:

```ts
import { createTestRenderer } from "@opentui/core/testing";
import type { Factory, View } from "./view";

export interface ViewHarness<P> {
  view: View<P>;
  /** Settle the renderer and return the rendered char grid. */
  frame(): Promise<string>;
  /** Send a keypress by ParsedKey name, e.g. "p", "up", "return". */
  press(key: string): Promise<void>;
  destroy(): void;
}

/**
 * Mount one view in an in-memory renderer for assertions.
 *
 * Synchronisation is deterministic via `waitForVisualIdle` — never sleep in a
 * test. The Ink suite's `setTimeout(10)` flush hack is not needed here and
 * must not be reintroduced.
 */
export async function renderView<P>(
  factory: Factory<P>,
  initial: P,
  size: { width: number; height: number },
): Promise<ViewHarness<P>> {
  const t = await createTestRenderer(size);
  const view = factory(t.renderer, initial);
  t.renderer.root.add(view.root);

  const frame = async () => {
    await t.waitForVisualIdle();
    await t.renderOnce();
    return t.captureCharFrame();
  };

  return {
    view,
    frame,
    press: async (key: string) => {
      t.mockInput.pressKey(key);
      await t.waitForVisualIdle();
    },
    destroy: () => view.destroy(),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- view`
Expected: PASS — both assertions, including that `"first"` is gone after update.

- [ ] **Step 6: Commit**

```bash
git add src/replay/tui/view.ts src/replay/tui/testHarness.ts src/replay/tui/__tests__/view.test.ts
git commit -m "feat(replay): add View contract and OpenTUI test harness"
```

---

### Task 3: Theme tokens

Ink accepted colour-name strings. Core wants explicit values, and the redesign calls for a dim token instead of Ink's `dimColor` boolean.

**Files:**
- Modify: `src/replay/tui/theme.ts`
- Create: `src/replay/tui/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: `SessionStatus` from `./state` (unchanged).
- Produces: `color` (with a new `dim` and `text` member), `icon`, `sessionIcon`, `sessionColor`, `levelColor`, `ATTR_BOLD`. Every widget task imports these.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { color, levelColor, sessionColor, sessionIcon } from "../theme";

describe("theme", () => {
  it("maps session status to icon and colour", () => {
    expect(sessionIcon("done")).toBe("✓");
    expect(sessionIcon("rejected")).toBe("✗");
    expect(sessionIcon("truncated")).toBe("⊘");
    expect(sessionIcon("running")).toBe("▶");
    expect(sessionIcon("pending")).toBe("·");
    expect(sessionColor("done")).toBe(color.success);
    expect(sessionColor("pending")).toBe(color.text);
  });

  it("maps log level to colour, defaulting to body text", () => {
    expect(levelColor("error")).toBe(color.error);
    expect(levelColor("warn")).toBe(color.warn);
    expect(levelColor("info")).toBe(color.text);
  });

  it("exposes a dim token distinct from body text", () => {
    expect(color.dim).not.toBe(color.text);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- theme`
Expected: FAIL — `sessionColor("pending")` returns `undefined`, and `color.text`/`color.dim` do not exist.

- [ ] **Step 3: Rewrite `theme.ts`**

Replace the `color` const and the three mapper functions. Keep the `icon` const and the file's existing doc comment about width-1 glyphs — that constraint still holds.

```ts
/** Semantic palette. Hex strings; Core parses them to RGBA. */
export const color = {
  /** Active / in-flight / cursor. */
  accent: "#00d7d7",
  success: "#5faf5f",
  error: "#d75f5f",
  /** Truncated, paused, and other "attention" states. */
  warn: "#d7af5f",
  /** Directories in the file browser. */
  dir: "#5f87d7",
  /** Frame borders and chrome. */
  chrome: "#6c6c6c",
  /** Secondary/de-emphasised text. Replaces Ink's `dimColor`. */
  dim: "#8a8a8a",
  /** Default body text. */
  text: "#d0d0d0",
} as const;

/** Core text attribute bitmask for bold. Replaces Ink's `bold` prop. */
export const ATTR_BOLD = 1;

export function sessionColor(status: SessionStatus): string {
  switch (status) {
    case "done":
      return color.success;
    case "rejected":
      return color.error;
    case "truncated":
      return color.warn;
    case "running":
      return color.accent;
    default:
      return color.text;
  }
}

/** Colour for a log line based on its level. */
export function levelColor(level: string): string {
  if (level === "error") return color.error;
  if (level === "warn") return color.warn;
  return color.text;
}
```

Note the signature change: `sessionColor` and `levelColor` now return `string`, never `undefined`. Core has no "inherit" sentinel, so every caller must pass a real colour.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- theme`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/replay/tui/theme.ts src/replay/tui/__tests__/theme.test.ts
git commit -m "feat(replay): convert theme to explicit colour tokens"
```

---

### Task 4: Keymap table and KeyRouter

The design centrepiece. Today four scattered `useInput` blocks implement the keys while `shortKeys()` separately hardcodes the hint strings — the two can drift silently. This task makes the table the single source of truth for both.

**Files:**
- Create: `src/replay/tui/keymap.ts`
- Create: `src/replay/tui/__tests__/keymap.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Phase`, `Binding`, `BINDINGS`, `helpLine(phase, ctx)`, `HELP_DETAILS`, `createKeyRouter(...)`, `KeyRouter`. Tasks 10–14 consume all of these.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/keymap.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { BINDINGS, createKeyRouter, helpLine } from "../keymap";

describe("keymap", () => {
  it("derives the help line from the binding table", () => {
    const line = helpLine("running", { canBegin: false });
    expect(line).toContain("[s] stop-now");
    expect(line).toContain("[p] pause");
    expect(line).toContain("[?] help");
    // A binding from another phase must not leak in.
    expect(line).not.toContain("begin");
  });

  it("hides conditional bindings when unavailable", () => {
    expect(helpLine("selecting", { canBegin: false })).not.toContain("[B]");
    expect(helpLine("selecting", { canBegin: true })).toContain("[B] begin");
  });

  it("every binding has a unique action within its phase", () => {
    const seen = new Set<string>();
    for (const b of BINDINGS) {
      const id = `${b.phase}:${b.action}`;
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
  });

  it("dispatches the action for a pressed key in the active phase", () => {
    const onAction = vi.fn();
    const router = createKeyRouter({
      getPhase: () => "running",
      getContext: () => ({ canBegin: false }),
      onAction,
    });

    router.handle({ name: "p" });
    // The key is passed through: multi-key bindings (up/down, pageup/pagedown)
    // resolve their direction from it in Task 14's dispatch table.
    expect(onAction).toHaveBeenCalledWith("pause", { name: "p" });

    // A key bound only in another phase is ignored.
    onAction.mockClear();
    router.handle({ name: "f" });
    expect(onAction).not.toHaveBeenCalled();
  });

  it("respects `when` guards at dispatch time, not just in help", () => {
    const onAction = vi.fn();
    const router = createKeyRouter({
      getPhase: () => "selecting",
      getContext: () => ({ canBegin: false }),
      onAction,
    });
    router.handle({ name: "B" });
    expect(onAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- keymap`
Expected: FAIL — cannot resolve `../keymap`.

- [ ] **Step 3: Write `keymap.ts`**

Create `src/replay/tui/keymap.ts`:

```ts
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
  { phase: "selecting", keys: ["up", "down"], hint: "↑↓", label: "move", action: "move" },
  { phase: "selecting", keys: ["pageup", "pagedown"], hint: "PgUp/PgDn", label: "page", action: "page" },
  { phase: "selecting", keys: ["return"], hint: "Enter", label: "open", action: "open" },
  { phase: "selecting", keys: ["space"], hint: "Space", label: "toggle", action: "toggle" },
  { phase: "selecting", keys: ["u", "left", "backspace"], hint: "u", label: "up", action: "up" },
  { phase: "selecting", keys: ["a"], hint: "a", label: "all", action: "selectAll" },
  { phase: "selecting", keys: ["c"], hint: "c", label: "clear", action: "clear" },
  { phase: "selecting", keys: ["v"], hint: "v", label: "convert", action: "convert", when: canBegin },
  { phase: "selecting", keys: ["t"], hint: "t", label: "idTag", action: "editIdTag" },
  { phase: "selecting", keys: ["B", "b"], hint: "B", label: "begin", action: "begin", when: canBegin },
  { phase: "selecting", keys: ["q"], hint: "q", label: "quit", action: "quit" },

  // --- converting ---
  { phase: "converting", keys: ["up", "down"], hint: "↑↓", label: "field", action: "field" },
  { phase: "converting", keys: ["space", "left", "right"], hint: "Space/←→", label: "toggle", action: "toggleRebase" },
  { phase: "converting", keys: ["return"], hint: "Enter", label: "accept", action: "accept" },
  { phase: "converting", keys: ["escape"], hint: "Esc", label: "cancel", action: "cancel" },

  // --- running ---
  { phase: "running", keys: ["s"], hint: "s", label: "stop-now", action: "stop" },
  { phase: "running", keys: ["p"], hint: "p", label: "pause", action: "pause" },
  { phase: "running", keys: ["a"], hint: "a", label: "abort", action: "abort" },
  { phase: "running", keys: ["l", "L"], hint: "l", label: "file-log", action: "toggleFileLog" },
  { phase: "running", keys: ["?"], hint: "?", label: "help", action: "toggleHelp" },

  // --- complete ---
  { phase: "complete", keys: ["up", "down"], hint: "↑↓", label: "scroll", action: "scroll" },
  { phase: "complete", keys: ["pageup", "pagedown"], hint: "PgUp/PgDn", label: "page", action: "scrollPage" },
  { phase: "complete", keys: ["f"], hint: "f", label: "file selection", action: "again" },
  { phase: "complete", keys: ["q", "return"], hint: "q", label: "quit", action: "quit" },
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
  onAction: (action: string, key: KeyLike) => void;
}): KeyRouter {
  return {
    handle(key) {
      const phase = opts.getPhase();
      const ctx = opts.getContext();
      const hit = activeBindings(phase, ctx).find((b) =>
        b.keys.includes(key.name),
      );
      if (hit === undefined) return false;
      opts.onAction(hit.action, key);
      return true;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- keymap`
Expected: PASS — all five cases.

- [ ] **Step 5: Leave `HelpBar.tsx` in place**

Its `HelpDetails` content now lives in `HELP_DETAILS` and its `shortKeys` in `helpLine`, but `App.tsx` still imports it. Per ruling R1 it is deleted in Task 16.

- [ ] **Step 6: Commit**

```bash
git add src/replay/tui/keymap.ts src/replay/tui/__tests__/keymap.test.ts
git commit -m "feat(replay): keybindings as data, help text derived from the table"
```

---

### Task 5: LogTail widget

The largest capability gain: today the log is an unscrollable last-6-lines window rebuilt every render. A `ScrollBox` with sticky-bottom scroll gives real history and mouse-wheel scrolling.

**Files:**
- Create: `src/replay/tui/widgets/logTail.ts`
- Create: `src/replay/tui/__tests__/logTail.test.ts`

**Interfaces:**
- Consumes: `View` from `../view`; `LogLine` from `../state`; `levelColor` from `../theme`.
- Produces: `createLogTail(ctx, props): View<LogTailProps>` where `LogTailProps = { logs: LogLine[]; height: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/logTail.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import type { LogLine } from "../state";
import { createLogTail } from "../widgets/logTail";

const line = (id: number, message: string, level = "info"): LogLine => ({
  id,
  message,
  level,
  ts: "2026-08-21T10:00:00Z",
});

describe("LogTail", () => {
  it("shows a placeholder when empty", async () => {
    const h = await renderView(
      createLogTail,
      { logs: [], height: 5 },
      { width: 40, height: 6 },
    );
    expect(await h.frame()).toContain("(no log lines yet)");
    h.destroy();
  });

  it("appends new lines without rebuilding existing ones", async () => {
    const h = await renderView(
      createLogTail,
      { logs: [line(1, "first")], height: 5 },
      { width: 40, height: 6 },
    );
    expect(await h.frame()).toContain("first");

    h.view.update({ logs: [line(1, "first"), line(2, "second")], height: 5 });
    const after = await h.frame();
    expect(after).toContain("first");
    expect(after).toContain("second");
    h.destroy();
  });

  it("keeps the newest line visible once the buffer overflows", async () => {
    const logs = Array.from({ length: 40 }, (_, i) => line(i, `entry-${i}`));
    const h = await renderView(
      createLogTail,
      { logs, height: 5 },
      { width: 40, height: 6 },
    );
    const frame = await h.frame();
    expect(frame).toContain("entry-39");
    expect(frame).not.toContain("entry-0");
    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- logTail`
Expected: FAIL — cannot resolve `../widgets/logTail`.

- [ ] **Step 3: Write the widget**

Create `src/replay/tui/widgets/logTail.ts`:

```ts
import { ScrollBoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { LogLine } from "../state";
import { color, levelColor } from "../theme";
import type { View } from "../view";

export interface LogTailProps {
  logs: LogLine[];
  /** Visible height of the scroll viewport, in rows. */
  height: number;
}

/**
 * Scrollable tail of the log buffer.
 *
 * Rows are pooled and reused: appending a log line assigns `.content` on a
 * recycled TextRenderable rather than rebuilding the list. Sticky-bottom
 * scrolling keeps the newest line visible while leaving history reachable —
 * the Ink version could only ever show the last N lines.
 */
export function createLogTail(
  ctx: RenderContext,
  initial: LogTailProps,
): View<LogTailProps> {
  const root = new ScrollBoxRenderable(ctx, {
    id: "logtail",
    height: initial.height,
    stickyScroll: true,
    stickyStart: "bottom",
    scrollY: true,
    viewportCulling: true,
  });

  const placeholder = new TextRenderable(ctx, {
    id: "logtail-empty",
    content: "(no log lines yet)",
    fg: color.dim,
  });
  root.add(placeholder);

  const pool: TextRenderable[] = [];
  let mounted = 0;

  const update = (props: LogTailProps) => {
    root.height = props.height;
    placeholder.visible = props.logs.length === 0;

    for (let i = 0; i < props.logs.length; i++) {
      const l = props.logs[i];
      let row = pool[i];
      if (row === undefined) {
        row = new TextRenderable(ctx, {
          id: `logtail-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = row;
        root.add(row);
      }
      row.content = l.message;
      row.fg = levelColor(l.level);
      row.visible = true;
    }
    // Hide surplus rows from a previous, longer buffer instead of destroying
    // them — the pool is reused on the next update.
    for (let i = props.logs.length; i < mounted; i++) {
      pool[i].visible = false;
    }
    mounted = props.logs.length;
  };

  update(initial);

  return {
    root,
    update,
    destroy() {
      root.destroyRecursively();
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- logTail`
Expected: PASS — all three cases, including that `entry-0` has scrolled out of view.

- [ ] **Step 5: Leave the Ink component in place**

`LogTail.tsx` and its test stay until Task 16 (ruling R1).

- [ ] **Step 6: Commit**

```bash
git add src/replay/tui/widgets/logTail.ts src/replay/tui/__tests__/logTail.test.ts
git commit -m "feat(replay): scrollable LogTail widget with pooled rows"
```

---

### Task 6: SessionList widget

A windowed list that follows the running session. The blank-row padding disappears — that existed only to hold Ink's height constant.

**Files:**
- Create: `src/replay/tui/widgets/sessionList.ts`
- Create: `src/replay/tui/__tests__/sessionList.test.ts`

**Interfaces:**
- Consumes: `View`; `SessionRow` from `../state`; `sessionColor`, `sessionIcon` from `../theme`.
- Produces: `createSessionList(ctx, props): View<SessionListProps>` where `SessionListProps = { sessions: SessionRow[]; rows: number }`; also `formatSessionRow(s): string` and `windowStart(total, budget, runningIndex): number`. Both are used only inside this widget; they are exported so the pure windowing arithmetic can be unit-tested directly rather than only through rendered frames. (An earlier draft claimed Task 13 reuses them — it does not; the summary screen uses `buildSummaryLines` with a `ScrollBox`.)

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/sessionList.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SessionRow } from "../state";
import { renderView } from "../testHarness";
import { createSessionList, formatSessionRow } from "../widgets/sessionList";

const row = (index: number, over: Partial<SessionRow> = {}): SessionRow => ({
  index,
  status: "pending",
  connectorId: "1",
  idTag: "RFID_TEST_1",
  ...over,
});

describe("SessionList", () => {
  it("formats a row with connector, idTag and tx", () => {
    const line = formatSessionRow(row(2, { status: "done", txId: 77 }));
    expect(line).toContain("#  2");
    expect(line).toContain("cid=1");
    expect(line).toContain("idTag=RFID_TEST_1");
    expect(line).toContain("tx=77");
  });

  it("appends the rejection reason only when rejected", () => {
    const rejected = formatSessionRow(
      row(1, { status: "rejected", reason: "Blocked" }),
    );
    expect(rejected).toContain("reason=Blocked");
    expect(formatSessionRow(row(1, { status: "done" }))).not.toContain(
      "reason=",
    );
  });

  it("windows around the running session", async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => row(i));
    sessions[15].status = "running";
    const h = await renderView(
      createSessionList,
      { sessions, rows: 4 },
      { width: 60, height: 5 },
    );
    const frame = await h.frame();
    expect(frame).toContain("# 15");
    expect(frame).not.toContain("#  0");
    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- sessionList`
Expected: FAIL — cannot resolve `../widgets/sessionList`.

- [ ] **Step 3: Write the widget**

Create `src/replay/tui/widgets/sessionList.ts`:

```ts
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { SessionRow } from "../state";
import { sessionColor, sessionIcon } from "../theme";
import type { View } from "../view";

export interface SessionListProps {
  sessions: SessionRow[];
  /** Visible rows. The window follows the running session. */
  rows: number;
}

export function formatSessionRow(s: SessionRow): string {
  const head = `${sessionIcon(s.status)} #${s.index.toString().padStart(3, " ")}`;
  const reason =
    s.status === "rejected" && s.reason !== undefined
      ? `  reason=${s.reason}`
      : "";
  return `${head} cid=${s.connectorId ?? "?"} idTag=${s.idTag ?? "?"} tx=${s.txId ?? "?"}${reason}`;
}

/**
 * First visible index, centring the running session when the list overflows.
 *
 * With no running session (`runningIndex === -1`) the anchor is `total`, so
 * the window sits at the tail — deliberate: when nothing is in flight the
 * most recent sessions are the interesting ones.
 */
export function windowStart(
  total: number,
  budget: number,
  runningIndex: number,
): number {
  if (total <= budget) return 0;
  const anchor = runningIndex >= 0 ? runningIndex : total;
  return Math.min(Math.max(0, anchor - Math.floor(budget / 2)), total - budget);
}

/**
 * Live session list. Rows are pooled: the window scrolls by reassigning
 * `.content` on a fixed set of renderables rather than rebuilding the list.
 * No blank-row padding — Core sizes the box, so there is no fixed-height
 * invariant to uphold by hand.
 */
export function createSessionList(
  ctx: RenderContext,
  initial: SessionListProps,
): View<SessionListProps> {
  const root = new BoxRenderable(ctx, {
    id: "sessionlist",
    flexDirection: "column",
  });
  const pool: TextRenderable[] = [];

  const update = (props: SessionListProps) => {
    const running = props.sessions.findIndex((s) => s.status === "running");
    const start = windowStart(props.sessions.length, props.rows, running);
    const slice = props.sessions.slice(start, start + props.rows);

    for (let i = 0; i < props.rows; i++) {
      let r = pool[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `session-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = r;
        root.add(r);
      }
      const s = slice[i];
      if (s === undefined) {
        r.visible = false;
        continue;
      }
      r.visible = true;
      r.content = formatSessionRow(s);
      r.fg = sessionColor(s.status);
    }
    // The row budget shrinks when the terminal does. Hide pooled rows beyond
    // it, or the previous, taller layout's rows linger on screen.
    for (let i = props.rows; i < pool.length; i++) pool[i].visible = false;
  };

  update(initial);

  return {
    root,
    update,
    destroy() {
      root.destroyRecursively();
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- sessionList`
Expected: PASS.

- [ ] **Step 5: Leave the Ink component in place**

`SessionList.tsx` and its test stay until Task 16 (ruling R1).

- [ ] **Step 6: Commit**

```bash
git add src/replay/tui/widgets/sessionList.ts src/replay/tui/__tests__/sessionList.test.ts
git commit -m "feat(replay): SessionList widget with pooled windowed rows"
```

---

### Task 7: ProgressBar and ProgressStrip widgets

**Files:**
- Create: `src/replay/tui/widgets/progressBar.ts`
- Create: `src/replay/tui/widgets/progressStrip.ts`
- Create: `src/replay/tui/__tests__/progressStrip.test.ts`

**Interfaces:**
- Consumes: `View`; `TuiState` from `../state`; `color` from `../theme`.
- Produces: `createProgressBar(ctx, props): View<ProgressBarProps>` with `ProgressBarProps = { label: string; current: number; total: number; barWidth: number; fg: string }`; `createProgressStrip(ctx, props): View<ProgressStripProps>` with `ProgressStripProps = { state: TuiState; width: number }`; `barWidthFor(width: number): number`.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/progressStrip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialState } from "../state";
import { renderView } from "../testHarness";
import { barWidthFor, createProgressStrip } from "../widgets/progressStrip";

describe("ProgressStrip", () => {
  it("collapses the bar glyphs on narrow terminals", () => {
    expect(barWidthFor(80)).toBe(10);
    expect(barWidthFor(64)).toBe(6);
    expect(barWidthFor(40)).toBe(0);
  });

  it("renders all three labels and a percentage", async () => {
    const state = {
      ...initialState,
      batchSessionsDone: 1,
      batchTotalSessions: 4,
      batchMessagesSent: 3,
      batchTotalMessages: 12,
      currentSessionMessagesSent: 1,
      currentSessionMessagesPlanned: 2,
    };
    const h = await renderView(
      createProgressStrip,
      { state, width: 80 },
      { width: 80, height: 2 },
    );
    const frame = await h.frame();
    expect(frame).toContain("Sess");
    expect(frame).toContain("Msg");
    expect(frame).toContain("Cur");
    expect(frame).toContain("25%");
    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- progressStrip`
Expected: FAIL — cannot resolve `../widgets/progressStrip`.

- [ ] **Step 3: Write `progressBar.ts`**

```ts
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { color } from "../theme";
import type { View } from "../view";

export interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  /** Width of the glyph run. 0 hides the bar, leaving percent and counts. */
  barWidth: number;
  fg: string;
}

/** Compact single-line indicator: `label ███░░  60% 3/5`. */
export function createProgressBar(
  ctx: RenderContext,
  initial: ProgressBarProps,
): View<ProgressBarProps> {
  const root = new BoxRenderable(ctx, {
    id: `bar-${initial.label}`,
    flexDirection: "row",
  });
  const label = new TextRenderable(ctx, { id: "label", fg: color.dim });
  const filled = new TextRenderable(ctx, { id: "filled" });
  const empty = new TextRenderable(ctx, { id: "empty", fg: color.dim });
  const pct = new TextRenderable(ctx, { id: "pct", fg: color.text });
  const counts = new TextRenderable(ctx, { id: "counts", fg: color.dim });
  for (const r of [label, filled, empty, pct, counts]) root.add(r);

  const update = (p: ProgressBarProps) => {
    const ratio =
      p.total > 0 ? Math.max(0, Math.min(1, p.current / p.total)) : 0;
    const on = Math.round(ratio * p.barWidth);
    label.content = `${p.label} `;
    filled.content = "█".repeat(on);
    filled.fg = p.fg;
    empty.content = "░".repeat(Math.max(0, p.barWidth - on));
    filled.visible = p.barWidth > 0;
    empty.visible = p.barWidth > 0;
    pct.content = `${(ratio * 100).toFixed(0).padStart(3, " ")}%`;
    counts.content = ` ${p.current}/${p.total}`;
  };

  update(initial);
  return { root, update, destroy: () => root.destroyRecursively() };
}
```

- [ ] **Step 4: Write `progressStrip.ts`**

```ts
import { BoxRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { TuiState } from "../state";
import { color } from "../theme";
import type { View } from "../view";
import { createProgressBar } from "./progressBar";

export interface ProgressStripProps {
  state: TuiState;
  /** Inner width available for the strip. */
  width: number;
}

/**
 * Bar width for the available columns. Below the narrow budget the glyphs are
 * dropped entirely so the strip always fits one line.
 */
export function barWidthFor(width: number): number {
  if (width >= 78) return 10;
  if (width >= 60) return 6;
  return 0;
}

/** The three batch/session progress bars compacted onto a single row. */
export function createProgressStrip(
  ctx: RenderContext,
  initial: ProgressStripProps,
): View<ProgressStripProps> {
  const root = new BoxRenderable(ctx, {
    id: "progressstrip",
    flexDirection: "row",
  });
  const bw = barWidthFor(initial.width);

  const sess = createProgressBar(ctx, {
    label: "Sess",
    current: 0,
    total: 0,
    barWidth: bw,
    fg: color.accent,
  });
  const msg = createProgressBar(ctx, {
    label: "Msg",
    current: 0,
    total: 0,
    barWidth: bw,
    fg: color.dir,
  });
  const cur = createProgressBar(ctx, {
    label: "Cur",
    current: 0,
    total: 0,
    barWidth: bw,
    fg: color.success,
  });

  root.add(sess.root);
  root.add(new BoxRenderable(ctx, { id: "strip-gap-1", paddingLeft: 2 }));
  root.add(msg.root);
  root.add(new BoxRenderable(ctx, { id: "strip-gap-2", paddingLeft: 2 }));
  root.add(cur.root);

  const update = (p: ProgressStripProps) => {
    const w = barWidthFor(p.width);
    sess.update({
      label: "Sess",
      barWidth: w,
      fg: color.accent,
      current: p.state.batchSessionsDone,
      total: p.state.batchTotalSessions,
    });
    msg.update({
      label: "Msg",
      barWidth: w,
      fg: color.dir,
      current: p.state.batchMessagesSent,
      total: p.state.batchTotalMessages,
    });
    cur.update({
      label: "Cur",
      barWidth: w,
      fg: color.success,
      current: p.state.currentSessionMessagesSent,
      total: p.state.currentSessionMessagesPlanned ?? 0,
    });
  };

  update(initial);

  return {
    root,
    update,
    destroy() {
      sess.destroy();
      msg.destroy();
      cur.destroy();
      root.destroyRecursively();
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- progressStrip`
Expected: PASS — `25%` comes from the Sess bar (1/4).

- [ ] **Step 6: Commit** (the Ink components stay until Task 16, ruling R1)

```bash
git add src/replay/tui/widgets/progressBar.ts src/replay/tui/widgets/progressStrip.ts src/replay/tui/__tests__/progressStrip.test.ts
git commit -m "feat(replay): ProgressBar and ProgressStrip widgets"
```

---

### Task 8: FileQueue and FileDots widgets

**Files:**
- Create: `src/replay/tui/widgets/fileQueue.ts`
- Create: `src/replay/tui/__tests__/fileQueue.test.ts`

**Interfaces:**
- Consumes: `View`; `AuthSource` from `../../connection`; `color`, `icon` from `../theme`.
- Produces: `FileStatus` — **moved here verbatim; `index_replay_16_tui.ts` and `app.ts` both import this type, so its shape must not change** — plus `createFileQueue(ctx, props): View<FileQueueProps>` with `FileQueueProps = { files: FileStatus[]; currentIndex: number; rows: number }`, `createFileDots(ctx, props): View<FileDotsProps>` with `FileDotsProps = { files: FileStatus[]; currentIndex: number }`, and `formatFileRow(f: FileStatus): string`.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/fileQueue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import type { FileStatus } from "../widgets/fileQueue";
import { createFileQueue, formatFileRow } from "../widgets/fileQueue";

const f = (over: Partial<FileStatus> = {}): FileStatus => ({
  path: "./data/CS_TEST_1.json",
  status: "pending",
  ...over,
});

describe("FileQueue", () => {
  it("prefers the resolved cpId over the raw path", () => {
    expect(formatFileRow(f({ cpId: "CS_TEST_1" }))).toContain("CS_TEST_1");
    expect(formatFileRow(f({ cpId: "CS_TEST_1" }))).not.toContain(".json");
  });

  it("shows a masked auth badge that never reveals the password", () => {
    expect(formatFileRow(f({ authSource: "file" }))).toContain("auth ✓");
    expect(formatFileRow(f({ authSource: "cli" }))).toContain("(cli)");
    expect(formatFileRow(f({ authSource: "env" }))).toContain("(env)");
    expect(formatFileRow(f())).not.toContain("auth");
  });

  it("shows a tally only once a file has finished", () => {
    const done = formatFileRow(f({ status: "done", succeeded: 3, rejected: 1 }));
    expect(done).toContain("✓3");
    expect(done).toContain("✗1");
    expect(formatFileRow(f({ status: "running" }))).not.toContain("✓0");
  });

  it("renders the queue", async () => {
    const h = await renderView(
      createFileQueue,
      { files: [f({ cpId: "CS_TEST_1" })], currentIndex: 0, rows: 3 },
      { width: 50, height: 4 },
    );
    expect(await h.frame()).toContain("CS_TEST_1");
    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- fileQueue`
Expected: FAIL — cannot resolve `../widgets/fileQueue`.

- [ ] **Step 3: Write the widget**

Create `src/replay/tui/widgets/fileQueue.ts`. `authBadge`, `statusIcon` and `statusColor` are ported from the deleted `FileQueue.tsx`, changing only `statusColor`'s fallback from `undefined` to `color.text`:

```ts
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { AuthSource } from "../../connection";
import { color, icon } from "../theme";
import type { View } from "../view";

export interface FileStatus {
  path: string;
  status: "pending" | "running" | "done" | "failed";
  succeeded?: number;
  rejected?: number;
  /** Resolved OCPP id for this file; shown instead of the path when known. */
  cpId?: string;
  /** Where this file's basic-auth password comes from; drives the badge. */
  authSource?: AuthSource;
}

/** Masked auth indicator — never reveals the password value. */
function authBadge(source?: AuthSource): string {
  switch (source) {
    case "file":
      return "  auth ✓";
    case "cli":
      return "  (cli)";
    case "env":
      return "  (env)";
    default:
      return "";
  }
}

const statusIcon = (s: FileStatus["status"]) =>
  s === "done"
    ? icon.done
    : s === "failed"
      ? icon.rejected
      : s === "running"
        ? icon.running
        : icon.pending;

const statusColor = (s: FileStatus["status"], isCurrent: boolean) =>
  isCurrent
    ? color.accent
    : s === "done"
      ? color.success
      : s === "failed"
        ? color.error
        : s === "running"
          ? color.accent
          : color.text;

export function formatFileRow(f: FileStatus): string {
  const tally =
    f.status === "done" || f.status === "failed"
      ? `  ${icon.done}${f.succeeded ?? 0} ${icon.rejected}${f.rejected ?? 0}`
      : "";
  return `${statusIcon(f.status)} ${f.cpId ?? f.path}${authBadge(f.authSource)}${tally}`;
}

export interface FileQueueProps {
  files: FileStatus[];
  currentIndex: number;
  rows: number;
}

/** Vertical batch file list, windowed around the current file. */
export function createFileQueue(
  ctx: RenderContext,
  initial: FileQueueProps,
): View<FileQueueProps> {
  const root = new BoxRenderable(ctx, {
    id: "filequeue",
    flexDirection: "column",
  });
  const pool: TextRenderable[] = [];

  const update = (p: FileQueueProps) => {
    let start = 0;
    if (p.files.length > p.rows) {
      const anchor = p.currentIndex >= 0 ? p.currentIndex : 0;
      start = Math.min(
        Math.max(0, anchor - Math.floor(p.rows / 2)),
        p.files.length - p.rows,
      );
    }
    for (let i = 0; i < p.rows; i++) {
      let r = pool[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `file-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = r;
        root.add(r);
      }
      const f = p.files[start + i];
      if (f === undefined) {
        r.visible = false;
        continue;
      }
      r.visible = true;
      r.content = formatFileRow(f);
      r.fg = statusColor(f.status, start + i === p.currentIndex);
    }
    // The row budget shrinks when the terminal does. Hide pooled rows beyond
    // it, or the previous, taller layout's rows linger on screen.
    for (let i = p.rows; i < pool.length; i++) pool[i].visible = false;
  };

  update(initial);
  return { root, update, destroy: () => root.destroyRecursively() };
}

export interface FileDotsProps {
  files: FileStatus[];
  currentIndex: number;
}

/**
 * Compact one-line batch indicator (`✓✓▶··`) for the running header. Hidden
 * for single-file batches, matching the Ink behaviour.
 */
export function createFileDots(
  ctx: RenderContext,
  initial: FileDotsProps,
): View<FileDotsProps> {
  const root = new BoxRenderable(ctx, { id: "filedots", flexDirection: "row" });
  const pool: TextRenderable[] = [];

  const update = (p: FileDotsProps) => {
    root.visible = p.files.length > 1;
    for (let i = 0; i < p.files.length; i++) {
      let d = pool[i];
      if (d === undefined) {
        d = new TextRenderable(ctx, { id: `dot-${i}` });
        pool[i] = d;
        root.add(d);
      }
      d.visible = true;
      d.content = statusIcon(p.files[i].status);
      d.fg = statusColor(p.files[i].status, i === p.currentIndex);
    }
    for (let i = p.files.length; i < pool.length; i++) pool[i].visible = false;
  };

  update(initial);
  return { root, update, destroy: () => root.destroyRecursively() };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- fileQueue`
Expected: PASS — all four cases.

- [ ] **Step 5: Commit** (the Ink component stays until Task 16, ruling R1)

```bash
git add src/replay/tui/widgets/fileQueue.ts src/replay/tui/__tests__/fileQueue.test.ts
git commit -m "feat(replay): FileQueue and FileDots widgets"
```

---

### Task 9: IdTagField widget

Replaces the hand-rolled keystroke accumulator with Core's real `Input` renderable — cursor movement, mid-string editing and paste come for free.

**Files:**
- Create: `src/replay/tui/widgets/idTagField.ts`
- Create: `src/replay/tui/__tests__/idTagField.test.ts`

**Interfaces:**
- Consumes: `View`; `color` from `../theme`.
- Produces: `createIdTagField(ctx, props): IdTagFieldView` where `IdTagFieldProps = { value: string; editing: boolean }` and `IdTagFieldView extends View<IdTagFieldProps>` adds `value(): string` so the screen can read the committed text.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/idTagField.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
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
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- idTagField`
Expected: FAIL — cannot resolve `../widgets/idTagField`.

- [ ] **Step 3: Write the widget**

Create `src/replay/tui/widgets/idTagField.ts`:

```ts
import { BoxRenderable, InputRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { color } from "../theme";
import type { View } from "../view";

export interface IdTagFieldProps {
  value: string;
  editing: boolean;
}

export interface IdTagFieldView extends View<IdTagFieldProps> {
  /** The text currently held by the input, for commit on Enter. */
  value(): string;
}

/**
 * Single-line idTag override readout/editor.
 *
 * While editing, a real `InputRenderable` owns the text — so cursor movement,
 * mid-string edits and paste all work. The Ink version accumulated keystrokes
 * into a string by hand and supported only append and backspace.
 */
export function createIdTagField(
  ctx: RenderContext,
  initial: IdTagFieldProps,
): IdTagFieldView {
  const root = new BoxRenderable(ctx, { id: "idtag", flexDirection: "row" });

  const label = new TextRenderable(ctx, {
    id: "idtag-label",
    content: "idTag ",
    fg: color.dim,
  });
  const readout = new TextRenderable(ctx, { id: "idtag-readout" });
  const hint = new TextRenderable(ctx, { id: "idtag-hint", fg: color.dim });
  const input = new InputRenderable(ctx, {
    id: "idtag-input",
    value: initial.value,
  });

  root.add(label);
  root.add(readout);
  root.add(input);
  root.add(hint);

  const update = (p: IdTagFieldProps) => {
    input.visible = p.editing;
    readout.visible = !p.editing;
    if (p.editing) {
      hint.content = " (Enter confirm · Esc cancel)";
    } else {
      readout.content = p.value === "" ? "(none)" : p.value;
      readout.fg = p.value === "" ? color.dim : color.success;
      hint.content = " [t] edit";
      // Re-seed the editor so opening it starts from the committed value.
      input.value = p.value;
    }
  };

  update(initial);

  return {
    root,
    update,
    value: () => input.value,
    destroy() {
      root.destroyRecursively();
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- idTagField`
Expected: PASS — all three cases.

If `InputRenderable`'s option or property names differ from `value`, check the shape first and adjust:

```bash
grep -A 20 "interface InputRenderableOptions" node_modules/@opentui/core/renderables/Input.d.ts
```

- [ ] **Step 5: Commit** (the Ink component stays until Task 16, ruling R1)

```bash
git add src/replay/tui/widgets/idTagField.ts src/replay/tui/__tests__/idTagField.test.ts
git commit -m "feat(replay): IdTagField widget backed by a real Input renderable"
```

---

### Task 10: Frame chrome and the running dashboard

The first screen. It also introduces the shared frame that Tasks 11–13 reuse, so that scaffolding is folded in here.

**Files:**
- Create: `src/replay/tui/widgets/frame.ts`
- Create: `src/replay/tui/screens/run.ts`
- Create: `src/replay/tui/__tests__/runScreen.test.ts`

**Interfaces:**
- Consumes: `createProgressStrip`, `createSessionList`, `createLogTail`, `createFileDots` from Tasks 5–8; `helpLine`, `HELP_DETAILS` from Task 4; `TuiState` from `../state`; `fmtDuration` from `../format`.
- Produces: `createFrame(ctx, props): FrameView` with `FrameProps = { title: string; right: string }` and `FrameView extends View<FrameProps>` adding `readonly body: BoxRenderable` for children; `createRule(ctx): View<Record<string, never>>`; `createRunScreen(ctx, props): View<RunScreenProps>` with `RunScreenProps = { state: TuiState; files: FileStatus[]; currentIndex: number; width: number; height: number; elapsedMs: number; paused: boolean; fileLogEnabled: boolean; showHelp: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/runScreen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialState } from "../state";
import { renderView } from "../testHarness";
import { createRunScreen } from "../screens/run";

const props = (over = {}) => ({
  state: {
    ...initialState,
    phase: "running" as const,
    stationId: "CS_TEST_1",
    file: "./data/demo.json",
    sessions: [{ index: 0, status: "running" as const, connectorId: "1" }],
    successfulStarts: 2,
    rejected: 1,
    truncated: 0,
    logs: [
      { id: 1, ts: "2026-08-21T10:00:00Z", level: "info", message: "hello-log" },
    ],
  },
  files: [{ path: "./data/demo.json", status: "running" as const }],
  currentIndex: 0,
  width: 90,
  height: 20,
  elapsedMs: 65_000,
  paused: false,
  fileLogEnabled: false,
  showHelp: false,
  ...over,
});

describe("run screen", () => {
  it("shows station, file, tally, session row and log line", async () => {
    const h = await renderView(createRunScreen, props(), {
      width: 90,
      height: 20,
    });
    const frame = await h.frame();
    expect(frame).toContain("REPLAY");
    expect(frame).toContain("CS_TEST_1");
    expect(frame).toContain("demo.json");
    expect(frame).toContain("SESSIONS");
    expect(frame).toContain("cid=1");
    expect(frame).toContain("hello-log");
    expect(frame).toContain("1m5.0s");
    h.destroy();
  });

  it("surfaces paused and REC indicators only when active", async () => {
    const h = await renderView(createRunScreen, props(), {
      width: 90,
      height: 20,
    });
    expect(await h.frame()).not.toContain("paused");

    h.view.update(props({ paused: true, fileLogEnabled: true }));
    const frame = await h.frame();
    expect(frame).toContain("paused");
    expect(frame).toContain("REC");
    h.destroy();
  });

  it("toggles the expanded help block", async () => {
    const h = await renderView(createRunScreen, props(), {
      width: 90,
      height: 20,
    });
    expect(await h.frame()).not.toContain("stop the current session now");

    h.view.update(props({ showHelp: true }));
    expect(await h.frame()).toContain("stop the current session now");
    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- runScreen`
Expected: FAIL — cannot resolve `../screens/run`.

- [ ] **Step 3: Write `widgets/frame.ts`**

```ts
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { ATTR_BOLD, color } from "../theme";
import type { View } from "../view";

export interface FrameProps {
  /** Left-hand title content. */
  title: string;
  /** Right-aligned content on the title row, e.g. an elapsed clock. */
  right: string;
}

export interface FrameView extends View<FrameProps> {
  /** Attach screen content here, not to `root`. */
  readonly body: BoxRenderable;
  /**
   * Extra title-row content, between the title and the right-aligned clock
   * — e.g. a batch progress indicator. Attach here, not to `root`: `root`'s
   * only children are the title row and the body, so anything added
   * directly to `root` renders as a new row BELOW the body rather than
   * inline with the title.
   */
  readonly titleExtra: BoxRenderable;
}

/**
 * The single outer frame shared by every screen: a border with a title row
 * (left content plus right-aligned content) above a content body.
 *
 * Unlike the Ink version this takes no explicit width/height. Core measures
 * and clips, so the fixed-size arithmetic that upheld Ink's no-flicker
 * invariant is gone.
 */
export function createFrame(ctx: RenderContext, initial: FrameProps): FrameView {
  const root = new BoxRenderable(ctx, {
    id: "frame",
    border: true,
    borderColor: color.chrome,
    paddingLeft: 1,
    paddingRight: 1,
    flexDirection: "column",
    flexGrow: 1,
  });

  const titleRow = new BoxRenderable(ctx, {
    id: "frame-title-row",
    flexDirection: "row",
  });
  const title = new TextRenderable(ctx, {
    id: "frame-title",
    fg: color.accent,
    attributes: ATTR_BOLD,
    wrapMode: "none",
    truncate: true,
  });
  const spacer = new BoxRenderable(ctx, { id: "frame-spacer", flexGrow: 1 });
  const right = new TextRenderable(ctx, {
    id: "frame-right",
    fg: color.dim,
    wrapMode: "none",
    // Keep title-row extras (e.g. file dots) off the clock; without this the
    // two run together as `✓▶·1m5.0s`.
    marginLeft: 2,
  });
  titleRow.add(title);
  titleRow.add(spacer);
  titleRow.add(right);

  const body = new BoxRenderable(ctx, {
    id: "frame-body",
    flexDirection: "column",
    flexGrow: 1,
  });

  root.add(titleRow);
  root.add(body);

  const update = (p: FrameProps) => {
    title.content = p.title;
    right.content = p.right;
  };
  update(initial);

  return { root, body, update, destroy: () => root.destroyRecursively() };
}

/** A single-row horizontal divider, dimmed to read as chrome. */
export function createRule(ctx: RenderContext): View<Record<string, never>> {
  const root = new TextRenderable(ctx, {
    id: `rule-${ruleCounter++}`,
    content: "─".repeat(200),
    fg: color.chrome,
    wrapMode: "none",
    truncate: true,
  });
  return { root, update: () => {}, destroy: () => root.destroyRecursively() };
}

let ruleCounter = 0;
```

The rule is over-long and clipped by `truncate`, which replaces the Ink version's explicit `width` prop — Core clips to the parent, so the caller no longer has to compute the inner width.

- [ ] **Step 4: Write `screens/run.ts`**

```ts
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { basename } from "node:path";
import { fmtDuration } from "../format";
import { HELP_DETAILS, helpLine } from "../keymap";
import type { TuiState } from "../state";
import { ATTR_BOLD, color, icon } from "../theme";
import type { View } from "../view";
import { createFrame, createRule } from "../widgets/frame";
import { createFileDots, type FileStatus } from "../widgets/fileQueue";
import { createLogTail } from "../widgets/logTail";
import { createProgressStrip } from "../widgets/progressStrip";
import { createSessionList } from "../widgets/sessionList";

/** Below this inner width the body stacks vertically instead of two columns. */
const NARROW_COLS = 56;

export interface RunScreenProps {
  state: TuiState;
  files: FileStatus[];
  currentIndex: number;
  width: number;
  height: number;
  elapsedMs: number;
  paused: boolean;
  fileLogEnabled: boolean;
  showHelp: boolean;
}

function actionLabel(state: TuiState): string {
  if (state.phase === "running") {
    return `${icon.send} ${state.currentAction ?? "working"}`;
  }
  if (state.phase === "aborting") return "aborting";
  if (state.phase === "complete") return "complete";
  return "idle";
}

export function createRunScreen(
  ctx: RenderContext,
  initial: RunScreenProps,
): View<RunScreenProps> {
  const frame = createFrame(ctx, { title: "", right: "" });
  const dots = createFileDots(ctx, { files: initial.files, currentIndex: 0 });
  const strip = createProgressStrip(ctx, {
    state: initial.state,
    width: initial.width,
  });

  const columns = new BoxRenderable(ctx, {
    id: "run-columns",
    flexDirection: "row",
    flexGrow: 1,
  });
  const leftCol = new BoxRenderable(ctx, {
    id: "run-left",
    flexDirection: "column",
    paddingRight: 1,
  });
  const rightCol = new BoxRenderable(ctx, {
    id: "run-right",
    flexDirection: "column",
    flexGrow: 1,
    paddingLeft: 1,
  });

  const tally = new TextRenderable(ctx, { id: "run-tally" });
  const sessions = createSessionList(ctx, {
    sessions: initial.state.sessions,
    rows: 8,
  });
  const logLabel = new TextRenderable(ctx, {
    id: "run-log-label",
    content: "LOG",
    attributes: ATTR_BOLD,
    fg: color.text,
  });
  const logs = createLogTail(ctx, { logs: initial.state.logs, height: 8 });

  leftCol.add(tally);
  leftCol.add(sessions.root);
  rightCol.add(logLabel);
  rightCol.add(logs.root);
  columns.add(leftCol);
  columns.add(rightCol);

  const helpBlock = new BoxRenderable(ctx, {
    id: "run-help",
    flexDirection: "column",
  });
  for (const [i, line] of HELP_DETAILS.entries()) {
    helpBlock.add(
      new TextRenderable(ctx, {
        id: `run-help-${i}`,
        content: line,
        fg: color.dim,
        wrapMode: "none",
        truncate: true,
      }),
    );
  }

  const statusRow = new BoxRenderable(ctx, {
    id: "run-status",
    flexDirection: "row",
  });
  const action = new TextRenderable(ctx, {
    id: "run-action",
    fg: color.accent,
    wrapMode: "none",
    truncate: true,
  });
  const keys = new TextRenderable(ctx, {
    id: "run-keys",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });
  const statusSpacer = new BoxRenderable(ctx, {
    id: "run-status-spacer",
    flexGrow: 1,
  });
  const pausedTag = new TextRenderable(ctx, {
    id: "run-paused",
    content: " paused",
    fg: color.warn,
  });
  const recTag = new TextRenderable(ctx, {
    id: "run-rec",
    content: ` ${icon.rec} REC`,
    fg: color.error,
  });
  statusRow.add(action);
  statusRow.add(keys);
  statusRow.add(statusSpacer);
  statusRow.add(pausedTag);
  statusRow.add(recTag);

  frame.body.add(strip.root);
  frame.body.add(createRule(ctx).root);
  frame.body.add(columns);
  frame.body.add(helpBlock);
  frame.body.add(createRule(ctx).root);
  frame.body.add(statusRow);
  // Title-row slot, not `frame.root` — see FrameView.titleExtra.
  frame.titleExtra.add(dots.root);

  const update = (p: RunScreenProps) => {
    const fileBase = p.state.file ? basename(p.state.file) : "(loading)";
    const batch =
      p.files.length > 1
        ? ` · file ${p.currentIndex + 1}/${p.files.length}`
        : "";
    frame.update({
      title: `REPLAY  ${p.state.stationId ?? "—"} · ${fileBase}${batch}`,
      right: fmtDuration(p.elapsedMs),
    });
    dots.update({ files: p.files, currentIndex: p.currentIndex });
    strip.update({ state: p.state, width: p.width });

    tally.content = `SESSIONS ${icon.done}${p.state.successfulStarts} ${icon.rejected}${p.state.rejected} ${icon.truncated}${p.state.truncated}`;

    // border(2) + title(1) + strip(1) + rule(1) + rule(1) + status(1)
    // = 7 rows of chrome consumed outside the two-column body. Forgetting
    // the frame's two border rows overflows the flex-grow columns box into
    // the help block and status row.
    const body = Math.max(
      3,
      p.height - 7 - (p.showHelp ? HELP_DETAILS.length : 0),
    );
    const wide = p.width >= NARROW_COLS;
    columns.flexDirection = wide ? "row" : "column";
    // Core's width setter takes number | "auto" | template — not undefined.
    leftCol.width = wide
      ? Math.max(24, Math.min(Math.floor(p.width * 0.5), 52))
      : "auto";

    sessions.update({
      sessions: p.state.sessions,
      rows: wide ? body - 1 : Math.max(1, Math.floor((body - 2) / 2)),
    });
    logs.update({
      logs: p.state.logs,
      height: wide
        ? body - 1
        : Math.max(1, body - 2 - Math.floor((body - 2) / 2)),
    });

    helpBlock.visible = p.showHelp;
    action.content = actionLabel(p.state);
    keys.content = `   ${helpLine("running", { canBegin: false })}`;
    pausedTag.visible = p.paused;
    recTag.visible = p.fileLogEnabled;
  };

  update(initial);

  return {
    root: frame.root,
    update,
    destroy() {
      dots.destroy();
      strip.destroy();
      sessions.destroy();
      logs.destroy();
      frame.destroy();
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- runScreen`
Expected: PASS — all three cases.

- [ ] **Step 6: Commit** (the Ink chrome stays until Task 16, ruling R1)

```bash
git add src/replay/tui/widgets/frame.ts src/replay/tui/screens/run.ts src/replay/tui/__tests__/runScreen.test.ts
git commit -m "feat(replay): frame chrome and running dashboard screen"
```

---

### Task 11: Select screen (file browser, with `ready` merged in)

Two panes: the directory listing on the left, the current selection on the right. The right pane **must** show each selected file's resolved identity (`cpId` and masked auth badge) — that is what makes merging the `ready` screen capability-preserving rather than a capability loss.

**Files:**
- Create: `src/replay/tui/screens/select.ts`
- Create: `src/replay/tui/__tests__/selectScreen.test.ts`

**Interfaces:**
- Consumes: `createFrame`, `createRule`, `createFileQueue`, `createIdTagField`, `helpLine`.
- Produces: `createSelectScreen(ctx, props): SelectScreenView`. `SelectScreenProps = { cwd: string; selected: string[]; fileStatusFor: (path: string) => FileStatus; idTag: string; editingIdTag: boolean; width: number; height: number }`. `SelectScreenView extends View<SelectScreenProps>` adds the action handlers the KeyRouter drives: `move(delta: number): void`, `page(delta: number): void`, `open(): void`, `toggle(): void`, `up(): void`, `selectAll(): void`, `clear(): void`, `selection(): string[]`, `idTagValue(): string`.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/selectScreen.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import { createSelectScreen } from "../screens/select";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "vcp-select-"));
  mkdirSync(join(dir, "nested"));
  writeFileSync(join(dir, "CS_TEST_1.json"), "{}");
  writeFileSync(join(dir, "CS_TEST_2.json"), "{}");
  writeFileSync(join(dir, "notes.txt"), "ignore me");
  return dir;
}

const props = (dir: string, over = {}) => ({
  cwd: dir,
  selected: [] as string[],
  fileStatusFor: (path: string) => ({ path, status: "pending" as const }),
  idTag: "",
  editingIdTag: false,
  width: 90,
  height: 20,
  ...over,
});

describe("select screen", () => {
  it("lists directories and json files, hiding other extensions", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    const frame = await h.frame();
    expect(frame).toContain("SELECT FILES");
    expect(frame).toContain("nested/");
    expect(frame).toContain("CS_TEST_1.json");
    expect(frame).not.toContain("notes.txt");
    h.destroy();
  });

  it("selects all json in the directory and reports the count", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    h.view.selectAll();
    expect(h.view.selection()).toHaveLength(2);
    expect(await h.frame()).toContain("2 selected");

    h.view.clear();
    expect(h.view.selection()).toHaveLength(0);
    h.destroy();
  });

  it("shows the resolved cpId and auth badge for selected files", async () => {
    const dir = fixture();
    const path = join(dir, "CS_TEST_1.json");
    const h = await renderView(
      createSelectScreen,
      props(dir, {
        selected: [path],
        fileStatusFor: (p: string) => ({
          path: p,
          status: "pending" as const,
          cpId: "CS_TEST_1",
          authSource: "file" as const,
        }),
      }),
      { width: 90, height: 20 },
    );
    const frame = await h.frame();
    expect(frame).toContain("CS_TEST_1");
    expect(frame).toContain("auth ✓");
    h.destroy();
  });

  it("only offers begin once something is selected", async () => {
    const dir = fixture();
    const h = await renderView(createSelectScreen, props(dir), {
      width: 90,
      height: 20,
    });
    expect(await h.frame()).not.toContain("[B] begin");

    h.view.selectAll();
    expect(await h.frame()).toContain("[B] begin");
    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- selectScreen`
Expected: FAIL — cannot resolve `../screens/select`.

- [ ] **Step 3: Write `screens/select.ts`**

Port the directory-reading and cursor logic from `FileBrowser.tsx`. Key behaviours that must carry over: `..` appears as the first row unless at the filesystem root; only `.json` files are listed alongside directories; the cursor window centres on the cursor; `selectAll` takes only the JSON files in the current directory.

```ts
import { BoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { helpLine } from "../keymap";
import { ATTR_BOLD, color, icon } from "../theme";
import type { View } from "../view";
import { createFrame, createRule } from "../widgets/frame";
import { createFileQueue, type FileStatus } from "../widgets/fileQueue";
import { createIdTagField } from "../widgets/idTagField";

interface Entry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface SelectScreenProps {
  cwd: string;
  selected: string[];
  fileStatusFor: (path: string) => FileStatus;
  idTag: string;
  editingIdTag: boolean;
  width: number;
  height: number;
}

export interface SelectScreenView extends View<SelectScreenProps> {
  move(delta: number): void;
  page(delta: number): void;
  /** Enter the directory under the cursor, or toggle a file. */
  open(): void;
  toggle(): void;
  up(): void;
  selectAll(): void;
  clear(): void;
  selection(): string[];
  idTagValue(): string;
}

function readEntries(dir: string): Entry[] {
  const out: Entry[] = [];
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    // Directory vanished or is unreadable mid-session; show it as empty
    // rather than tearing the TUI down.
    return out;
  }
  for (const name of names.sort()) {
    const path = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(path).isDirectory();
    } catch {
      continue;
    }
    if (isDir || name.toLowerCase().endsWith(".json")) {
      out.push({ name, path, isDir });
    }
  }
  // Directories first, then files — matching the Ink browser's ordering.
  return out.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
  );
}

export function createSelectScreen(
  ctx: RenderContext,
  initial: SelectScreenProps,
): SelectScreenView {
  let cwd = initial.cwd;
  let entries = readEntries(cwd);
  let cursor = 0;
  const selected = new Set<string>(initial.selected);
  let latest = initial;

  const frame = createFrame(ctx, { title: "", right: "" });
  const idTag = createIdTagField(ctx, {
    value: initial.idTag,
    editing: initial.editingIdTag,
  });

  const columns = new BoxRenderable(ctx, {
    id: "select-cols",
    flexDirection: "row",
    flexGrow: 1,
  });
  const leftCol = new BoxRenderable(ctx, {
    id: "select-left",
    flexDirection: "column",
    paddingRight: 1,
  });
  const rightCol = new BoxRenderable(ctx, {
    id: "select-right",
    flexDirection: "column",
    flexGrow: 1,
    paddingLeft: 1,
  });
  const selectedLabel = new TextRenderable(ctx, {
    id: "select-right-label",
    content: "SELECTED",
    attributes: ATTR_BOLD,
    fg: color.text,
  });
  const queue = createFileQueue(ctx, {
    files: [],
    currentIndex: -1,
    rows: 10,
  });
  rightCol.add(selectedLabel);
  rightCol.add(queue.root);
  columns.add(leftCol);
  columns.add(rightCol);

  const rows: TextRenderable[] = [];
  const help = new TextRenderable(ctx, {
    id: "select-help",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });

  frame.body.add(idTag.root);
  frame.body.add(createRule(ctx).root);
  frame.body.add(columns);
  frame.body.add(createRule(ctx).root);
  frame.body.add(help);

  /** `..` occupies row 0 unless we are at the filesystem root. */
  const showParent = () => dirname(cwd) !== cwd;
  const total = () => entries.length + (showParent() ? 1 : 0);
  const entryAt = (i: number): Entry | undefined =>
    showParent() ? entries[i - 1] : entries[i];

  const render = () => {
    // border(2) + title(1) + idTag(1) + rule(1) + rule(1) + help(1) = 7.
    const listRows = Math.max(3, latest.height - 7);
    const start = Math.min(
      Math.max(0, cursor - Math.floor(listRows / 2)),
      Math.max(0, total() - listRows),
    );

    for (let i = 0; i < listRows; i++) {
      let r = rows[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `select-row-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        rows[i] = r;
        leftCol.add(r);
      }
      const idx = start + i;
      if (idx >= total()) {
        r.visible = false;
        continue;
      }
      r.visible = true;
      const isCursor = idx === cursor;
      const marker = isCursor ? icon.cursor : " ";
      if (showParent() && idx === 0) {
        r.content = `${marker} ..`;
        r.fg = isCursor ? color.accent : color.dir;
        continue;
      }
      const e = entryAt(idx);
      if (e === undefined) {
        r.visible = false;
        continue;
      }
      const mark = selected.has(e.path) ? icon.done : " ";
      r.content = `${marker}${mark} ${e.isDir ? `${e.name}/` : e.name}`;
      r.fg = isCursor ? color.accent : e.isDir ? color.dir : color.text;
    }

    const list = Array.from(selected).sort();
    queue.update({
      files: list.map(latest.fileStatusFor),
      currentIndex: -1,
      // As listRows, minus this pane's own SELECTED label row.
      rows: Math.max(3, latest.height - 8),
    });

    frame.update({
      title: `SELECT FILES  ${cwd}`,
      right: `${selected.size} selected`,
    });
    idTag.update({ value: latest.idTag, editing: latest.editingIdTag });
    help.content = helpLine("selecting", { canBegin: selected.size > 0 });
  };

  const update = (p: SelectScreenProps) => {
    latest = p;
    if (p.cwd !== cwd) {
      cwd = p.cwd;
      entries = readEntries(cwd);
      cursor = 0;
    }
    render();
  };

  update(initial);

  return {
    root: frame.root,
    update,
    move(delta) {
      cursor = Math.max(0, Math.min(total() - 1, cursor + delta));
      render();
    },
    page(delta) {
      cursor = Math.max(0, Math.min(total() - 1, cursor + delta * 10));
      render();
    },
    open() {
      if (showParent() && cursor === 0) {
        cwd = dirname(cwd);
        entries = readEntries(cwd);
        cursor = 0;
        render();
        return;
      }
      const e = entryAt(cursor);
      if (e === undefined) return;
      if (e.isDir) {
        cwd = e.path;
        entries = readEntries(cwd);
        cursor = 0;
      } else if (selected.has(e.path)) {
        selected.delete(e.path);
      } else {
        selected.add(e.path);
      }
      render();
    },
    toggle() {
      const e = entryAt(cursor);
      if (e === undefined || e.isDir) return;
      if (selected.has(e.path)) selected.delete(e.path);
      else selected.add(e.path);
      render();
    },
    up() {
      if (!showParent()) return;
      cwd = dirname(cwd);
      entries = readEntries(cwd);
      cursor = 0;
      render();
    },
    selectAll() {
      for (const e of entries) if (!e.isDir) selected.add(e.path);
      render();
    },
    clear() {
      selected.clear();
      render();
    },
    selection: () => Array.from(selected).sort(),
    idTagValue: () => idTag.value(),
    destroy() {
      idTag.destroy();
      queue.destroy();
      frame.destroy();
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- selectScreen`
Expected: PASS — all four cases, including the `auth ✓` badge that makes the `ready` merge legitimate.

- [ ] **Step 5: Commit** (the Ink browser stays until Task 16, ruling R1)

```bash
git add src/replay/tui/screens/select.ts src/replay/tui/__tests__/selectScreen.test.ts
git commit -m "feat(replay): select screen with ready merged into the right pane"
```

---

### Task 12: Convert wizard screen

The stationId and password fields become real `Input` renderables. The wizard's queue logic in `convertQueue.ts` is already pure and is not touched.

**Files:**
- Create: `src/replay/tui/screens/convert.ts`
- Create: `src/replay/tui/__tests__/convertScreen.test.ts`

**Interfaces:**
- Consumes: `createFrame`, `createRule`; `helpLine`.
- Produces: `ConvertFormValues` and `ConvertWizardStats` (both moved here verbatim from `ConvertWizard.tsx`); `createConvertScreen(ctx, props): ConvertScreenView`. `ConvertScreenProps = { fileLabel: string; index: number; total: number; initialStationId: string; stats?: ConvertWizardStats; error?: string; width: number; height: number }`. `ConvertScreenView extends View<ConvertScreenProps>` adds `field(delta: number): void`, `values(): ConvertFormValues`, `isErrorMode(): boolean`, `canAccept(): boolean`, `toggleRebase(): void`.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/convertScreen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderView } from "../testHarness";
import { createConvertScreen } from "../screens/convert";

const props = (over = {}) => ({
  fileLabel: "CS_TEST_1.log",
  index: 0,
  total: 2,
  initialStationId: "CS_TEST_1",
  stats: { calls: 120, sessions: 3, dropped: 1, corrupt: 0 },
  width: 80,
  height: 16,
  ...over,
});

describe("convert screen", () => {
  it("prefills the station id and shows parse stats and queue position", async () => {
    const h = await renderView(createConvertScreen, props(), {
      width: 80,
      height: 16,
    });
    const frame = await h.frame();
    expect(frame).toContain("CS_TEST_1.log");
    expect(frame).toContain("1/2");
    expect(frame).toContain("CS_TEST_1");
    expect(frame).toContain("120");
    expect(h.view.values().stationId).toBe("CS_TEST_1");
    h.destroy();
  });

  it("defaults rebase-timestamps on and toggles it", async () => {
    const h = await renderView(createConvertScreen, props(), {
      width: 80,
      height: 16,
    });
    expect(h.view.values().rebaseTimestamps).toBe(true);
    h.view.toggleRebase();
    expect(h.view.values().rebaseTimestamps).toBe(false);
    h.destroy();
  });

  it("blocks accept when the station id is blank", async () => {
    const h = await renderView(
      createConvertScreen,
      props({ initialStationId: "" }),
      { width: 80, height: 16 },
    );
    expect(h.view.canAccept()).toBe(false);
    h.destroy();
  });

  it("enters read-only error mode when the file failed to parse", async () => {
    const h = await renderView(
      createConvertScreen,
      props({ error: "unreadable frame at line 4", stats: undefined }),
      { width: 80, height: 16 },
    );
    const frame = await h.frame();
    expect(frame).toContain("unreadable frame at line 4");
    expect(h.view.isErrorMode()).toBe(true);
    h.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- convertScreen`
Expected: FAIL — cannot resolve `../screens/convert`.

- [ ] **Step 3: Write `screens/convert.ts`**

```ts
import { BoxRenderable, InputRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { ATTR_BOLD, color } from "../theme";
import type { View } from "../view";
import { createFrame, createRule } from "../widgets/frame";

export interface ConvertFormValues {
  stationId: string;
  password: string;
  rebaseTimestamps: boolean;
}

export interface ConvertWizardStats {
  calls: number;
  sessions: number;
  dropped: number;
  corrupt: number;
}

const FIELD_ROWS = ["stationId", "password", "timestamps"] as const;

export interface ConvertScreenProps {
  /** Basename of the source file, for the heading. */
  fileLabel: string;
  /** 0-based position in the wizard queue. */
  index: number;
  total: number;
  initialStationId: string;
  /** Parse summary; undefined when the file failed to parse. */
  stats?: ConvertWizardStats;
  /** When set, the form is read-only: accept skips (drops the file). */
  error?: string;
  width: number;
  height: number;
}

export interface ConvertScreenView extends View<ConvertScreenProps> {
  field(delta: number): void;
  values(): ConvertFormValues;
  isErrorMode(): boolean;
  canAccept(): boolean;
  toggleRebase(): void;
}

export function createConvertScreen(
  ctx: RenderContext,
  initial: ConvertScreenProps,
): ConvertScreenView {
  let row = 0;
  let rebase = true;
  let latest = initial;

  const frame = createFrame(ctx, { title: "", right: "" });
  const stats = new TextRenderable(ctx, {
    id: "convert-stats",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });
  const errorLine = new TextRenderable(ctx, {
    id: "convert-error",
    fg: color.error,
    wrapMode: "none",
    truncate: true,
  });

  const mkRow = (id: string, label: string) => {
    const box = new BoxRenderable(ctx, {
      id: `${id}-row`,
      flexDirection: "row",
    });
    const lbl = new TextRenderable(ctx, {
      id: `${id}-label`,
      content: label.padEnd(12),
      fg: color.dim,
    });
    box.add(lbl);
    return { box, lbl };
  };

  const stationRow = mkRow("station", "stationId");
  const stationInput = new InputRenderable(ctx, {
    id: "station-input",
    value: initial.initialStationId,
  });
  stationRow.box.add(stationInput);

  const passwordRow = mkRow("password", "password");
  const passwordInput = new InputRenderable(ctx, {
    id: "password-input",
    value: "",
  });
  passwordRow.box.add(passwordInput);

  const rebaseRow = mkRow("rebase", "timestamps");
  const rebaseValue = new TextRenderable(ctx, { id: "rebase-value" });
  rebaseRow.box.add(rebaseValue);

  const help = new TextRenderable(ctx, {
    id: "convert-help",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });

  frame.body.add(stats);
  frame.body.add(errorLine);
  frame.body.add(createRule(ctx).root);
  frame.body.add(stationRow.box);
  frame.body.add(passwordRow.box);
  frame.body.add(rebaseRow.box);
  frame.body.add(createRule(ctx).root);
  frame.body.add(help);

  const errorMode = () => latest.error !== undefined;

  const render = () => {
    frame.update({
      title: `CONVERT  ${latest.fileLabel}`,
      right: `${latest.index + 1}/${latest.total}`,
    });

    stats.visible = latest.stats !== undefined;
    if (latest.stats !== undefined) {
      const s = latest.stats;
      stats.content = `calls ${s.calls} · sessions ${s.sessions} · dropped ${s.dropped} · corrupt ${s.corrupt}`;
    }
    errorLine.visible = errorMode();
    errorLine.content = latest.error ?? "";

    // Read-only while in error mode: the only action is skip.
    stationInput.visible = !errorMode();
    passwordInput.visible = !errorMode();

    const focus = (i: number) =>
      !errorMode() && row === i ? color.accent : color.dim;
    stationRow.lbl.fg = focus(0);
    passwordRow.lbl.fg = focus(1);
    rebaseRow.lbl.fg = focus(2);
    rebaseValue.content = rebase ? "rebase to now" : "keep original";
    rebaseValue.fg = row === 2 && !errorMode() ? color.accent : color.text;
    rebaseValue.attributes = row === 2 ? ATTR_BOLD : 0;

    help.content = errorMode()
      ? "[Enter] skip  [Esc] cancel"
      : "[↑↓] field  [Space/←→] toggle  [Enter] accept  [Esc] cancel";
  };

  const update = (p: ConvertScreenProps) => {
    const fileChanged = p.fileLabel !== latest.fileLabel;
    latest = p;
    if (fileChanged) {
      // A new file in the queue resets the form.
      row = 0;
      rebase = true;
      stationInput.value = p.initialStationId;
      passwordInput.value = "";
    }
    render();
  };

  update(initial);

  return {
    root: frame.root,
    update,
    field(delta) {
      if (errorMode()) return;
      row = Math.max(0, Math.min(FIELD_ROWS.length - 1, row + delta));
      render();
    },
    toggleRebase() {
      if (errorMode()) return;
      rebase = !rebase;
      render();
    },
    values: () => ({
      stationId: stationInput.value.trim(),
      password: passwordInput.value,
      rebaseTimestamps: rebase,
    }),
    isErrorMode: errorMode,
    canAccept: () => !errorMode() && stationInput.value.trim().length > 0,
    destroy() {
      frame.destroy();
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- convertScreen`
Expected: PASS — all four cases.

- [ ] **Step 5: Commit** (the Ink wizard stays until Task 16, ruling R1)

```bash
git add src/replay/tui/screens/convert.ts src/replay/tui/__tests__/convertScreen.test.ts
git commit -m "feat(replay): convert wizard screen with real Input fields"
```

---

### Task 13: Summary screen

`buildSummaryLines` is already pure and well tested. **Extract it unchanged** into its own module and keep its existing assertions — do not rewrite it.

**Files:**
- Create: `src/replay/tui/summaryLines.ts` (holds `SummaryLine` + `buildSummaryLines`, moved verbatim)
- Create: `src/replay/tui/screens/summary.ts`
- Create: `src/replay/tui/__tests__/summaryLines.test.ts`
- Create: `src/replay/tui/__tests__/summaryScreen.test.ts`

**Interfaces:**
- Consumes: `createFrame`, `createRule`, `createFileQueue`, `helpLine`; `FileResult` from `../state`; `fmtDuration` from `../format`.
- Produces: `SummaryLine`, `buildSummaryLines(results: FileResult[]): SummaryLine[]`; `createSummaryScreen(ctx, props): SummaryScreenView` with `SummaryScreenProps = { fileResults: FileResult[]; files: FileStatus[]; width: number; height: number }` and `SummaryScreenView extends View<SummaryScreenProps>` adding `scroll(delta: number): void` and `scrollPage(delta: number): void`.

- [ ] **Step 1: Move `buildSummaryLines` out, keeping its tests**

Copy `SummaryLine`, `sessionLabel` and `buildSummaryLines` **verbatim** from `SummaryScreen.tsx` into a new `src/replay/tui/summaryLines.ts`, changing only the import of `FileStatus` (now from `./widgets/fileQueue`). Then port the pure assertions from `__tests__/SummaryScreen.test.tsx` into `__tests__/summaryLines.test.ts`, importing from `../summaryLines`.

- [ ] **Step 2: Run the moved tests to verify they still pass**

Run: `npm test -- summaryLines`
Expected: PASS — behaviour is unchanged, only the module moved.

- [ ] **Step 3: Write the failing screen test**

Create `src/replay/tui/__tests__/summaryScreen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FileResult } from "../state";
import { renderView } from "../testHarness";
import { createSummaryScreen } from "../screens/summary";

const results: FileResult[] = [
  {
    file: "./data/demo.json",
    stationId: "CS_TEST_1",
    sessions: [
      { index: 0, status: "done", connectorId: "1", idTag: "RFID_TEST_1", txId: 10 },
      { index: 1, status: "rejected", connectorId: "1", idTag: "RFID_TEST_1", reason: "Blocked" },
    ],
    summary: undefined,
  },
];

const props = (over = {}) => ({
  fileResults: results,
  files: [{ path: "./data/demo.json", status: "done" as const }],
  width: 80,
  height: 14,
  ...over,
});

describe("summary screen", () => {
  it("shows the banner, per-file header and session breakdown", async () => {
    const h = await renderView(createSummaryScreen, props(), {
      width: 80,
      height: 14,
    });
    const frame = await h.frame();
    expect(frame).toContain("demo.json");
    expect(frame).toContain("s000");
    expect(frame).toContain("Blocked");
    h.destroy();
  });

  it("scrolls without going past the ends", async () => {
    const many: FileResult[] = [
      {
        file: "./data/big.json",
        stationId: "CS_TEST_1",
        sessions: Array.from({ length: 60 }, (_, i) => ({
          index: i,
          status: "done" as const,
          connectorId: "1",
          idTag: "RFID_TEST_1",
          txId: i,
        })),
        summary: undefined,
      },
    ];
    const h = await renderView(
      createSummaryScreen,
      props({ fileResults: many }),
      { width: 80, height: 14 },
    );
    expect(await h.frame()).toContain("s000");

    h.view.scrollPage(1);
    expect(await h.frame()).not.toContain("s000");

    // Scrolling back past the top must clamp, not underflow.
    h.view.scrollPage(-99);
    expect(await h.frame()).toContain("s000");
    h.destroy();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm test -- summaryScreen`
Expected: FAIL — cannot resolve `../screens/summary`.

- [ ] **Step 5: Write `screens/summary.ts`**

```ts
import { ScrollBoxRenderable, TextRenderable } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import { fmtDuration } from "../format";
import { helpLine } from "../keymap";
import type { FileResult } from "../state";
import { ATTR_BOLD, color } from "../theme";
import { buildSummaryLines } from "../summaryLines";
import type { View } from "../view";
import { createFrame, createRule } from "../widgets/frame";
import type { FileStatus } from "../widgets/fileQueue";

export interface SummaryScreenProps {
  fileResults: FileResult[];
  files: FileStatus[];
  width: number;
  height: number;
}

export interface SummaryScreenView extends View<SummaryScreenProps> {
  scroll(delta: number): void;
  scrollPage(delta: number): void;
}

/**
 * Post-run breakdown. A ScrollBox owns the scrolling, so the manual scroll
 * offset, clamping and blank-padding arithmetic in the Ink version are gone.
 */
export function createSummaryScreen(
  ctx: RenderContext,
  initial: SummaryScreenProps,
): SummaryScreenView {
  const frame = createFrame(ctx, { title: "", right: "" });
  const banner = new TextRenderable(ctx, {
    id: "summary-banner",
    attributes: ATTR_BOLD,
    wrapMode: "none",
    truncate: true,
  });
  const list = new ScrollBoxRenderable(ctx, {
    id: "summary-list",
    scrollY: true,
    viewportCulling: true,
    flexGrow: 1,
  });
  const help = new TextRenderable(ctx, {
    id: "summary-help",
    fg: color.dim,
    wrapMode: "none",
    truncate: true,
  });

  frame.body.add(banner);
  frame.body.add(createRule(ctx).root);
  frame.body.add(list);
  frame.body.add(createRule(ctx).root);
  frame.body.add(help);

  const pool: TextRenderable[] = [];
  let pageRows = 1;

  const update = (p: SummaryScreenProps) => {
    const lines = buildSummaryLines(p.fileResults);
    const totals = p.fileResults.reduce(
      (acc, r) => {
        for (const s of r.sessions) {
          if (s.status === "done") acc.done++;
          else if (s.status === "rejected") acc.rejected++;
          else if (s.status === "truncated") acc.truncated++;
        }
        acc.exitCode = Math.max(acc.exitCode, r.summary?.exitCode ?? 0);
        acc.durationMs += r.summary?.durationMs ?? 0;
        return acc;
      },
      { done: 0, rejected: 0, truncated: 0, exitCode: 0, durationMs: 0 },
    );
    const filesDone = p.files.filter((f) => f.status === "done").length;
    const filesFailed = p.files.filter((f) => f.status === "failed").length;
    const ok = totals.exitCode === 0;

    frame.update({
      title: "COMPLETE",
      right: fmtDuration(totals.durationMs),
    });
    banner.content = `${ok ? "PASS" : "FAIL"}  files ${filesDone} ok, ${filesFailed} failed · sessions ${totals.done} done, ${totals.rejected} rejected, ${totals.truncated} truncated`;
    banner.fg = ok ? color.success : color.error;

    for (let i = 0; i < lines.length; i++) {
      let r = pool[i];
      if (r === undefined) {
        r = new TextRenderable(ctx, {
          id: `summary-line-${i}`,
          wrapMode: "none",
          truncate: true,
        });
        pool[i] = r;
        list.add(r);
      }
      r.visible = true;
      r.content = lines[i].text;
      r.fg = lines[i].color ?? color.text;
      r.attributes = lines[i].bold === true ? ATTR_BOLD : 0;
    }
    for (let i = lines.length; i < pool.length; i++) pool[i].visible = false;

    // border(2) + title(1) + banner(1) + rule(1) + rule(1) + help(1) = 7.
    pageRows = Math.max(1, p.height - 7);
    help.content = helpLine("complete", { canBegin: false });
  };

  update(initial);

  return {
    root: frame.root,
    update,
    scroll(delta) {
      list.scrollTop = Math.max(0, list.scrollTop + delta);
    },
    scrollPage(delta) {
      list.scrollTop = Math.max(0, list.scrollTop + delta * pageRows);
    },
    destroy() {
      frame.destroy();
    },
  };
}
```

`ScrollBoxRenderable` clamps `scrollTop` to its content height internally, so the upper bound needs no manual `maxScroll` computation; only the lower bound is clamped here.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- summary`
Expected: PASS — both `summaryLines` and `summaryScreen` suites.

- [ ] **Step 7: Commit** (the Ink screen stays until Task 16, ruling R1)

```bash
git add src/replay/tui/summaryLines.ts src/replay/tui/screens/summary.ts src/replay/tui/__tests__/summaryLines.test.ts src/replay/tui/__tests__/summaryScreen.test.ts
git commit -m "feat(replay): summary screen backed by a ScrollBox"
```

---

### Task 14: App — ScreenRouter, AppController and key wiring

The integration hub. Everything built so far is inert until this task connects state, screens and keys.

**Files:**
- Create: `src/replay/tui/app.ts`
- Create: `src/replay/tui/__tests__/app.test.ts`
- Delete: `src/replay/tui/App.tsx`, `src/replay/tui/__tests__/App.test.tsx`, `src/replay/tui/__tests__/App.batch.test.tsx`, `src/replay/tui/__tests__/App.convert.test.tsx`

**Interfaces:**
- Consumes: every screen from Tasks 10–13; `createKeyRouter`, `Phase` from Task 4; `reduce`, `initialState` from `../state`; `createReplayController` from `../controller`; `buildConvertQueue`, `readRawLogEntries`, `ConvertTask` from `./convertQueue`; `parseRawLog`, `buildReplayFile` from `../logConvert`; `basename` from `node:path`.
  Note `ConvertTask` may need `stats` and `error` fields added if `buildConvertQueue` does not already surface them; check `convertQueue.ts` before writing `convertPropsForCurrentTask`.
- Produces: `createApp(ctx, options): AppHandle`.
  **`AppController` keeps its exact existing shape** — `{ dispatch, setFileStatuses, setCurrentFileIndex, showSummary, controller }` — because `index_replay_16_tui.ts` and `batchLoop.ts` depend on it.
  `AppOptions = { endpoint: string; initialFiles: FileStatus[]; autoBegin?: boolean; cwd?: string; initialIdTag?: string; sessionLogDir?: string; onBegin?: (files: string[], idTagOverride?: string) => void; onRoundChoice?: (choice: "again" | "quit") => void; onExit?: () => void }`.
  `AppHandle = { root: Renderable; controller: AppController; handleKey(key: KeyLike): void; destroy(): void }`.

- [ ] **Step 1: Write the failing test**

Create `src/replay/tui/__tests__/app.test.ts`:

```ts
import { createTestRenderer } from "@opentui/core/testing";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

async function mount(options = {}) {
  const t = await createTestRenderer({ width: 90, height: 22 });
  const app = createApp(t.renderer, {
    endpoint: "ws://localhost:3000",
    initialFiles: [{ path: "./data/demo.json", status: "pending" }],
    autoBegin: true,
    ...options,
  });
  t.renderer.root.add(app.root);
  const frame = async () => {
    await t.waitForVisualIdle();
    await t.renderOnce();
    return t.captureCharFrame();
  };
  return { app, frame };
}

describe("app", () => {
  it("renders the dashboard and reflects dispatched events", async () => {
    const { app, frame } = await mount();
    app.controller.dispatch({
      type: "run_start",
      ts: "2026-08-21T10:00:00Z",
      stationId: "CS_TEST_1",
      file: "./data/demo.json",
      totalSessions: 1,
    });
    app.controller.dispatch({
      type: "session_start",
      ts: "2026-08-21T10:00:01Z",
      sessionIndex: 0,
      connectorId: "1",
      idTag: "RFID_TEST_1",
      windowStart: "2026-08-21T10:00:00Z",
      messagesPlanned: 2,
    });
    const out = await frame();
    expect(out).toContain("CS_TEST_1");
    expect(out).toContain("cid=1");
    app.destroy();
  });

  it("routes running-phase keys to the replay controller", async () => {
    const { app, frame } = await mount();
    expect(app.controller.controller.paused).toBe(false);
    app.handleKey({ name: "p" });
    expect(app.controller.controller.paused).toBe(true);
    expect(await frame()).toContain("paused");
    app.destroy();
  });

  it("switches to the summary screen and offers another round", async () => {
    const onRoundChoice = vi.fn();
    const { app, frame } = await mount({ onRoundChoice });
    app.controller.showSummary();
    expect(await frame()).toContain("COMPLETE");

    app.handleKey({ name: "f" });
    expect(onRoundChoice).toHaveBeenCalledWith("again");
    expect(await frame()).toContain("SELECT FILES");
    app.destroy();
  });

  it("reflows on resize without losing state", async () => {
    const { app, frame } = await mount();
    app.controller.dispatch({
      type: "run_start",
      ts: "2026-08-21T10:00:00Z",
      stationId: "CS_TEST_1",
      file: "./data/demo.json",
      totalSessions: 1,
    });
    app.resize(58, 12);
    expect(await frame()).toContain("CS_TEST_1");
    app.destroy();
  });

  it("ignores keys bound to inactive phases", async () => {
    const onRoundChoice = vi.fn();
    const { app } = await mount({ onRoundChoice });
    // "f" belongs to the complete phase; we are still running.
    app.handleKey({ name: "f" });
    expect(onRoundChoice).not.toHaveBeenCalled();
    app.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- app`
Expected: FAIL — cannot resolve `../app`.

- [ ] **Step 3: Write `app.ts`**

Port the phase machine, the session-log writer (`writeSessionLog`, `safe`, `formatLogEntry`) and the convert-queue orchestration from `App.tsx` **verbatim** — that logic is correct and is not what this migration is changing. Only the rendering and input layers are new.

The structure:

```ts
import { BoxRenderable, type Renderable, type RenderContext } from "@opentui/core";
import type { RenderContext } from "@opentui/core";
import type { ReplayEvent } from "../events";
import { createReplayController, type ReplayController } from "../controller";
import { createKeyRouter, type KeyLike, type Phase } from "./keymap";
import { createConvertScreen } from "./screens/convert";
import { createRunScreen } from "./screens/run";
import { createSelectScreen } from "./screens/select";
import { createSummaryScreen } from "./screens/summary";
import { initialState, reduce, type TuiState } from "./state";
import type { FileStatus } from "./widgets/fileQueue";
import type { View } from "./view";

export interface AppController {
  dispatch: (event: ReplayEvent) => void;
  setFileStatuses: (files: FileStatus[]) => void;
  setCurrentFileIndex: (i: number) => void;
  /** Flip the app to the post-run summary screen (batch finished). */
  showSummary: () => void;
  controller: ReplayController;
}

export interface AppOptions {
  endpoint: string;
  initialFiles: FileStatus[];
  autoBegin?: boolean;
  cwd?: string;
  initialIdTag?: string;
  sessionLogDir?: string;
  onBegin?: (files: string[], idTagOverride?: string) => void;
  onRoundChoice?: (choice: "again" | "quit") => void;
  /** Called when the user quits; the host tears the renderer down. */
  onExit?: () => void;
}

export interface AppHandle {
  root: Renderable;
  controller: AppController;
  handleKey(key: KeyLike): void;
  /** Spec lifecycle item 7: reflow when the terminal is resized. */
  resize(cols: number, rows: number): void;
  destroy(): void;
}

export function createApp(ctx: RenderContext, options: AppOptions): AppHandle {
  const root = new BoxRenderable(ctx, {
    id: "app",
    flexDirection: "column",
    flexGrow: 1,
  });

  let state: TuiState = initialState;
  let phase: Phase = options.autoBegin === true ? "running" : "selecting";
  let files = options.initialFiles.slice();
  let currentIndex = 0;
  let idTag = options.initialIdTag ?? "";
  let editingIdTag = false;
  let paused = false;
  let fileLogEnabled = false;
  let showHelp = false;
  const startedAt = Date.now();

  const replayController = createReplayController();

  // Exactly one screen is alive at a time.
  let current: AnyView | undefined;
  let select: SelectScreenView | undefined;
  let convert: ConvertScreenView | undefined;
  let summary: SummaryScreenView | undefined;

  /** Terminal size, refreshed from the renderer on every RESIZE. */
  let width = 90;
  let height = 24;

  const selectProps = () => ({
    cwd: options.cwd ?? process.cwd(),
    selected: files.map((f) => f.path),
    fileStatusFor: (path: string): FileStatus => ({ path, status: "pending" }),
    idTag,
    editingIdTag,
    width,
    height,
  });

  const runProps = () => ({
    state,
    files,
    currentIndex,
    width,
    height,
    elapsedMs: Date.now() - startedAt,
    paused,
    fileLogEnabled,
    showHelp,
  });

  const summaryProps = () => ({
    fileResults: state.fileResults,
    files,
    width,
    height,
  });

  // The convert queue, built when the user presses `v` in the select screen.
  let convertTasks: ConvertTask[] = [];
  let convertIndex = 0;

  const convertPropsForCurrentTask = (): ConvertScreenProps => {
    const task = convertTasks[convertIndex];
    return {
      fileLabel: task === undefined ? "" : basename(task.sourcePath),
      index: convertIndex,
      total: convertTasks.length,
      initialStationId: task?.stationId ?? "",
      stats: task?.stats,
      error: task?.error,
      width,
      height,
    };
  };

  /** Push current state into whichever screen is mounted. */
  const rerender = () => {
    if (phase === "selecting") select?.update(selectProps());
    else if (phase === "running") (current as View<RunScreenProps>).update(runProps());
    else if (phase === "complete") summary?.update(summaryProps());
    else if (phase === "converting" && convert !== undefined) {
      convert.update(convertPropsForCurrentTask());
    }
  };

  /** Destroy the outgoing screen and build the incoming one. */
  const mountScreen = (next: Phase) => {
    current?.destroy();
    current = undefined;
    select = undefined;
    convert = undefined;
    summary = undefined;
    phase = next;

    if (next === "selecting") {
      select = createSelectScreen(ctx, selectProps());
      current = select as AnyView;
    } else if (next === "running") {
      current = createRunScreen(ctx, runProps()) as AnyView;
    } else if (next === "complete") {
      summary = createSummaryScreen(ctx, summaryProps());
      current = summary as AnyView;
    } else {
      convert = createConvertScreen(ctx, convertPropsForCurrentTask());
      current = convert as AnyView;
    }
    root.add(current.root);
  };

  const keyRouter = createKeyRouter({
    getPhase: () => phase,
    getContext: () => ({ canBegin: /* selection non-empty */ false }),
    onAction: (action, key) => { /* dispatch table, see Step 4 */ },
  });

  mountScreen(phase);

  return {
    root,
    controller: {
      dispatch(event) {
        state = reduce(state, event);
        rerender();
      },
      setFileStatuses(next) {
        files = next;
        rerender();
      },
      setCurrentFileIndex(i) {
        currentIndex = i;
        rerender();
      },
      showSummary() {
        mountScreen("complete");
      },
      controller: replayController,
    },
    handleKey: (key) => keyRouter.handle(key),
    resize(cols, rows) {
      width = cols;
      height = rows;
      rerender();
    },
    destroy() {
      current?.view.destroy();
      root.destroyRecursively();
    },
  };
}
```

- [ ] **Step 4: Implement the action dispatch table**

Inside `onAction`, map each action id from `keymap.ts` to behaviour. Every action must be handled; an unhandled id is a bug:

| Phase | Action | Behaviour |
|---|---|---|
| selecting | `move` | `select.move(key.name === "up" ? -1 : 1)` |
| selecting | `page` | `select.page(key.name === "pageup" ? -1 : 1)` |
| selecting | `open` / `toggle` / `up` / `selectAll` / `clear` | delegate to the same-named `SelectScreenView` method |
| selecting | `editIdTag` | `editingIdTag = true; rerender()` |
| selecting | `convert` | build the convert queue from the selection, `mountScreen("converting")` |
| selecting | `begin` | `phase = "running"; options.onBegin(select.selection(), idTag || undefined)` |
| selecting | `quit` | `options.onExit?.()` |
| converting | `field` | `convert.field(key.name === "up" ? -1 : 1)` |
| converting | `toggleRebase` | `convert.toggleRebase()` |
| converting | `accept` | if `isErrorMode()` skip the file; else if `canAccept()` write the converted file and advance the queue |
| converting | `cancel` | return to `selecting`, keeping files already written |
| running | `pause` | `replayController.togglePause(); paused = replayController.paused; rerender()` |
| running | `stop` | `replayController.requestStop()` |
| running | `abort` | `replayController.requestAbort()` |
| running | `toggleFileLog` | `fileLogEnabled = !fileLogEnabled; rerender()` |
| running | `toggleHelp` | `showHelp = !showHelp; rerender()` |
| complete | `scroll` | `summary.scroll(key.name === "up" ? -1 : 1)` |
| complete | `scrollPage` | `summary.scrollPage(key.name === "pageup" ? -1 : 1)` |
| complete | `again` | reset per-run state, keep `idTag` and `fileLogEnabled`, `mountScreen("selecting")`, `options.onRoundChoice?.("again")` |
| complete | `quit` | `options.onRoundChoice?.("quit"); options.onExit?.()` |

While `editingIdTag` is true the idTag editor owns the keyboard: `Enter` commits `select.idTagValue()` into `idTag`, `Esc` discards, and no other binding fires. Implement that as an early return at the top of `onAction`'s caller — i.e. inside `handleKey`, before `keyRouter.handle`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- app`
Expected: PASS — all four cases.

- [ ] **Step 6: Delete the Ink app and commit**

```bash
git rm src/replay/tui/App.tsx src/replay/tui/__tests__/App.test.tsx src/replay/tui/__tests__/App.batch.test.tsx src/replay/tui/__tests__/App.convert.test.tsx
git add src/replay/tui/app.ts src/replay/tui/__tests__/app.test.ts
git commit -m "feat(replay): ScreenRouter, AppController and keymap-driven input"
```

---

### Task 15: Entrypoint and lifecycle

Replaces Ink's `render()`/`waitUntilExit()` with a `CliRenderer`, and deletes the hand-rolled alternate-screen module.

**Files:**
- Modify: `index_replay_16_tui.ts`
- Delete: `src/replay/tui/altScreen.ts`
- Modify: `src/replay/tui/layout.ts` (drop `useTerminalSize`, keep `fitText`)

**Interfaces:**
- Consumes: `createApp` from Task 14.
- Produces: no new exports; `runBatchLoop`'s call sites are unchanged.

- [ ] **Step 1: Replace the Ink mount**

In `index_replay_16_tui.ts`, delete the `enterAlternateScreen()` call and the `ink`/`react` imports, and replace the `render(...)` block with:

```ts
import { createCliRenderer } from "@opentui/core";
import { createApp } from "./src/replay/tui/app";

const renderer = await createCliRenderer({
  screenMode: "alternate-screen",
  exitOnCtrlC: true,
  exitSignals: ["SIGINT", "SIGTERM"],
  clearOnShutdown: true,
  targetFps: 30,
});

let resolveExit!: () => void;
const exited = new Promise<void>((r) => {
  resolveExit = r;
});

const app = createApp(renderer, {
  endpoint,
  initialFiles,
  autoBegin,
  cwd: process.cwd(),
  initialIdTag: idTagOverride,
  onBegin: (files, tag) => begins.push({ files, idTagOverride: tag }),
  onRoundChoice: (choice) => choices.push(choice),
  onExit: () => resolveExit(),
});
renderer.root.add(app.root);
renderer.keyInput.on("keypress", (e) => app.handleKey(e));
// Spec lifecycle item 7: reflow instead of corrupting on resize.
app.resize(renderer.width, renderer.height);
renderer.on("resize", (cols: number, rows: number) => app.resize(cols, rows));

const ctrl = app.controller;
```

`ctrlReady`/`deferred<AppController>()` and the `onReady` callback are no longer needed — `createApp` returns the controller synchronously. Delete them.

Also repoint the `FileStatus` import, whose module Task 8 deleted:

```ts
// was: import type { FileStatus } from "./src/replay/tui/FileQueue";
import type { FileStatus } from "./src/replay/tui/widgets/fileQueue";
```

- [ ] **Step 2: Rewire the exit path**

The `finally` block currently awaits `inkApp.waitUntilExit()`, leaves the alt-screen by hand and writes the summary to stdout. Replace it with:

```ts
} finally {
  logger.remove(transport);
  await Promise.race([exited, Promise.resolve()]);
  app.destroy();
  renderer.destroy();
  // Land the one-line summary in normal scrollback, after the alternate
  // screen has been torn down by `renderer.destroy()`.
  process.stdout.write(`${lastLine}\n`);
  process.exit(exitCode);
}
```

- [ ] **Step 3: Preserve non-TTY auto-exit**

`useStdin().isRawModeSupported` is gone. Gate on the TTY directly, near the top of `main()`:

```ts
const interactive = process.stdin.isTTY === true;
```

Add `interactive?: boolean` to `AppOptions` and pass it from the entrypoint. In `app.ts`, inside `showSummary()`, reproduce the current auto-exit:

```ts
showSummary() {
  mountScreen("complete");
  // Non-TTY runs take no input, so nothing would ever quit the app. Exit
  // shortly after the final frame paints, matching the Ink behaviour.
  if (options.interactive === false) {
    setTimeout(() => options.onExit?.(), 100);
  }
},
```

- [ ] **Step 4: Suppress the stray FFI stderr line**

OpenTUI writes `"FFI is an experimental feature and might change at any time"` to stderr at startup, which would corrupt the alternate screen. Add this as the **first** statement in `main()`, before `createCliRenderer`:

```ts
const realStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
  const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
  if (text.includes("FFI is an experimental feature")) return true;
  return (realStderrWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
}) as typeof process.stderr.write;
```

- [ ] **Step 5: Trim `layout.ts`**

Delete `useTerminalSize`, `TerminalSize`, and the `ink`/`react` imports. Keep `fitText`, `FALLBACK_COLS` and `FALLBACK_ROWS` — `fitText` is still used for strings composed before render. Update the file's doc comment: the no-flicker invariant it describes is an Ink constraint that no longer applies.

- [ ] **Step 6: Verify the app actually runs**

```bash
npm run check
npm test
npm run replay:16:tui:pick
```

Expected: the file browser appears in the alternate screen, arrow keys move the cursor, `q` exits cleanly, the terminal is restored, and the summary line is the last thing printed. No stray FFI line.

- [ ] **Step 7: Commit**

```bash
git rm src/replay/tui/altScreen.ts
git add index_replay_16_tui.ts src/replay/tui/layout.ts src/replay/tui/app.ts
git commit -m "feat(replay): mount the TUI on a CliRenderer and drop altScreen"
```

---

### Task 16: Teardown and capability-parity sweep

**Files:**
- Delete: every remaining `.tsx` under `src/replay/tui/` and its tests
- Modify: `package.json`, `README.md`, `CLAUDE.md`

- [ ] **Step 0: Remove the Ink source, tests and dependencies (ruling R1)**

Tasks 4–13 deliberately left these in place so the tree stayed green. Remove them now, in one commit:

```bash
git rm src/replay/tui/*.tsx src/replay/tui/__tests__/*.test.tsx
npm uninstall ink react @types/react ink-testing-library
```

Then simplify `typecheck` in `package.json`, now that no `.tsx` remains:

```json
"typecheck": "tsc --noEmit --esModuleInterop --skipLibCheck --module esnext --moduleResolution bundler src/**/*.ts index_replay_16_tui.ts",
```

- [ ] **Step 1: Prove no Ink or React remains**

```bash
grep -rn "from \"ink\|ink-testing-library\|from \"react\"" src index_replay_16_tui.ts
find src -name "*.tsx"
grep -n "\"ink\"\|\"react\"\|@types/react" package.json
```

Expected: all three produce **no output**. If any `.tsx` remains, it was missed by an earlier task — port it before continuing.

- [ ] **Step 2: Walk the capability checklist**

Open the spec's "Capability inventory" section and exercise every item against a real run:

```bash
npm run replay:16:tui:pick
```

Confirm each of the five screens, all ~25 keybindings, the idTag editor, the file-log toggle, the `?` help overlay, resize reflow, and alt-screen restore on `Ctrl-C`. Then confirm the non-interactive path and its exit code:

```bash
npm run replay:16:tui -- ./data/some-file.json < /dev/null; echo "exit=$?"
```

Any item that does not behave as the checklist describes is a bug to fix in this task, not a variance to accept.

- [ ] **Step 3: Update the docs**

In `README.md`, document that the TUI requires Node with `--experimental-ffi` (supplied by the npm scripts) and record the verified Node + `@opentui/core` pairing. In `CLAUDE.md`, replace the Ink reference in the architecture notes with OpenTUI Core and the `View` contract.

- [ ] **Step 4: Full verification**

```bash
npm run check && npm test
```

Expected: lint, format, typecheck and the whole suite pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(replay): remove Ink remnants and document the OpenTUI runtime"
```

---

### Task 17: Terminal-theme-aware palette

Added mid-execution after the Task 3 review (ruling R3). Ink's `undefined` colour meant "inherit the terminal's foreground", so the old UI stayed legible on light and dark terminals alike. Core has **no inherit sentinel** — an unset `fg` renders pure white (verified: `rgba(255,255,255,255)`), and a fixed `#d0d0d0` is washed out on a light background. Closing this is capability parity, not polish.

**Files:**
- Modify: `src/replay/tui/theme.ts`
- Modify: `src/replay/tui/__tests__/theme.test.ts`
- Modify: `index_replay_16_tui.ts`

**Interfaces:**
- Consumes: `ThemeMode` from `@opentui/core`.
- Produces: `applyThemeMode(mode: ThemeMode): void`. `color` keeps its exact shape and member names, so **no widget or screen changes** — they read `color.x` at construct/update time and pick up whichever palette was applied at startup.

- [ ] **Step 1: Write the failing test**

Append to `src/replay/tui/__tests__/theme.test.ts`:

```ts
import { applyThemeMode, color, sessionColor } from "../theme";

describe("theme mode", () => {
  // Restore the default so mode changes cannot leak between test files.
  afterEach(() => applyThemeMode("dark"));

  it("darkens body text for light terminals", () => {
    applyThemeMode("dark");
    const darkText = color.text;
    applyThemeMode("light");
    expect(color.text).not.toBe(darkText);
    // Light-mode body text must be dark enough to read on white.
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(color.text.slice(i, i + 2), 16),
    );
    expect((r + g + b) / 3).toBeLessThan(128);
  });

  it("restores the dark palette", () => {
    applyThemeMode("light");
    applyThemeMode("dark");
    const [r, g, b] = [1, 3, 5].map((i) =>
      Number.parseInt(color.text.slice(i, i + 2), 16),
    );
    expect((r + g + b) / 3).toBeGreaterThan(128);
  });

  it("keeps every semantic token defined in both modes", () => {
    for (const mode of ["light", "dark"] as const) {
      applyThemeMode(mode);
      for (const key of [
        "accent", "success", "error", "warn", "dir", "chrome", "dim", "text",
      ] as const) {
        expect(color[key]).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  // Closes the coverage gap the Task 3 review flagged as a Minor.
  it("maps every session status to its semantic colour", () => {
    applyThemeMode("dark");
    expect(sessionColor("rejected")).toBe(color.error);
    expect(sessionColor("truncated")).toBe(color.warn);
    expect(sessionColor("running")).toBe(color.accent);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- theme`
Expected: FAIL — `applyThemeMode` is not exported.

- [ ] **Step 3: Make the palette swappable**

In `theme.ts`, replace the `color` const with a mutable token object plus two palettes. Keep every member name identical so no consumer changes:

```ts
import type { ThemeMode } from "@opentui/core";

export interface ThemePalette {
  accent: string;
  success: string;
  error: string;
  warn: string;
  dir: string;
  chrome: string;
  dim: string;
  text: string;
}

const DARK: ThemePalette = {
  accent: "#00d7d7",
  success: "#5faf5f",
  error: "#d75f5f",
  warn: "#d7af5f",
  dir: "#5f87d7",
  chrome: "#6c6c6c",
  dim: "#8a8a8a",
  text: "#d0d0d0",
};

/** Darkened for light backgrounds; same semantics, same member names. */
const LIGHT: ThemePalette = {
  accent: "#007070",
  success: "#2f7a2f",
  error: "#a32222",
  warn: "#8a6a00",
  dir: "#2a4fa3",
  chrome: "#9a9a9a",
  dim: "#6c6c6c",
  text: "#2a2a2a",
};

/**
 * Live semantic palette. Mutated in place by `applyThemeMode` at startup,
 * before any screen mounts, so widgets can keep reading `color.x` directly.
 *
 * Core has no "inherit the terminal foreground" colour — an unset `fg`
 * renders pure white — so the palette must be chosen explicitly rather than
 * delegated to the terminal the way Ink's `undefined` did.
 */
export const color: ThemePalette = { ...DARK };

export function applyThemeMode(mode: ThemeMode): void {
  Object.assign(color, mode === "light" ? LIGHT : DARK);
}
```

`ATTR_BOLD`, `icon`, `sessionIcon`, `sessionColor` and `levelColor` are unchanged — `sessionColor`/`levelColor` already read through `color`, so they follow the active palette automatically.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- theme`
Expected: PASS — all seven cases (three from Task 3, four new).

- [ ] **Step 5: Select the palette at startup**

In `index_replay_16_tui.ts`, immediately after `createCliRenderer` and **before** `createApp`:

```ts
import { applyThemeMode } from "./src/replay/tui/theme";

// Core cannot inherit the terminal's foreground, so pick a palette that
// suits it. Terminals that do not answer the query fall back to dark.
applyThemeMode((await renderer.waitForThemeMode(250)) ?? "dark");
```

The 250 ms cap matters: `waitForThemeMode` queries the terminal over OSC and many terminals never reply. Do not await it unbounded.

- [ ] **Step 6: Verify on a real terminal**

```bash
npm run check && npm test
npm run replay:16:tui:pick
```

Expected: full suite green; the TUI is legible. If your terminal is dark, temporarily force the light branch (`applyThemeMode("light")`) once to confirm the light palette renders readably, then revert that edit.

- [ ] **Step 7: Commit**

```bash
git add src/replay/tui/theme.ts src/replay/tui/__tests__/theme.test.ts index_replay_16_tui.ts
git commit -m "feat(replay): adapt the palette to the terminal's theme mode"
```
