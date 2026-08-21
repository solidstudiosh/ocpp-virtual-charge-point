# Replay TUI: migration from Ink to OpenTUI Core

**Status:** approved design, not yet implemented
**Date:** 2026-08-21
**Scope:** `src/replay/tui/`, `index_replay_16_tui.ts`, test suite, `package.json`

## Goal

Replace Ink/React with `@opentui/core` as the rendering layer for the OCPP 1.6
replay TUI. React leaves the repository entirely.

The only hard requirement is **capability parity**. Layout, visual design, and
component structure are free to change, and the design below deliberately
changes them where Ink's constraints — not the problem domain — shaped the
current code.

## Why this is viable on Node

The repository is Node-only. OpenTUI is commonly described as Bun-only, so
viability was verified empirically before this design was written:

| Question | Finding |
|---|---|
| Does Core need Bun? | No. `@opentui/core@0.5.6` ships NAPI prebuilds (`core-darwin-arm64` et al.) behind a `node` export condition. |
| What does Node need? | The `--experimental-ffi` flag. Without it Core throws `OpenTUI native FFI is not available for this runtime yet`. |
| Which Node version? | Upstream docs demand 26.4.0 *exactly*; that is their CI acceptance gate. Verified working on the repo's Volta pin, 26.1.0. |
| Does `NODE_OPTIONS` carry the flag? | Yes — `NODE_OPTIONS="--experimental-ffi"` is accepted, so npm scripts stay clean. |
| Is there a test renderer? | Yes — `@opentui/core/testing` exports `createTestRenderer`, `captureCharFrame`, `mockInput`, `ManualClock`. |

Bindings for React and Solid were both evaluated and rejected: React is being
removed by intent, and `@opentui/solid` requires a Babel pipeline (its Node
preload entrypoint is a Bun-only stub that throws) plus an exact
`solid-js@1.9.12` peer pin. Core needs no transform, no framework, and no
version pin.

## Capability inventory (the parity checklist)

Implementation is complete when every item below behaves as it does today.

### Lifecycle
1. Alternate-screen enter/exit, restored on normal exit, `SIGINT`, and `SIGTERM`.
2. Final one-line summary printed to normal scrollback after the UI tears down.
3. Exit codes preserved: `0` success, `3` fatal, `4` abort, `130`/`143` signals.
4. Non-TTY / piped mode: renders, takes no input, and auto-exits ~100ms after
   the run finishes (current behaviour, gated on raw mode being unavailable).
5. Winston `UiLogTransport` streams log records into the UI.
6. `AppController` handshake — `dispatch`, `setFileStatuses`, `setCurrentFileIndex`,
   `showSummary`, `controller` — with an exit promise the batch loop can race.
7. Terminal resize reflow.

### Screens and keys
- **selecting** — two-pane file browser. `↑↓` move, `PgUp/PgDn` page, `Enter`
  enter directory, `Space` toggle, `u`/`←`/`Backspace` up, `a` select all JSON
  here, `c` clear, `B` begin, `v` convert, `t` idTag, `q` quit.
- **ready** — file queue with per-file identity (cpId, masked auth source).
  `B` begin, `e` edit, `t` idTag, `q` quit. *(This screen is merged into*
  *`selecting` by the redesign; see "The `ready` merge". The per-file identity*
  *readout is binding; `e` is the one keybinding this design intentionally*
  *retires.)*
- **converting** — modal wizard over a queue of raw logs: stationId and password
  fields, rebase-timestamps toggle, `↑↓` field nav, `Enter` accept, `Esc` cancel,
  error mode `Enter` skip.
- **running** — dashboard: three progress bars, session list, log tail, status
  tally, per-file dots, elapsed clock, action line. `s` stop-now, `p` pause,
  `a` abort, `l` file-log toggle, `?` help.
- **complete** — scrollable per-session summary. `↑↓`/`PgUp/PgDn` scroll,
  `f` new round, `q`/`Enter` quit.

### Cross-cutting
- idTag override inline editor (`t`, `Enter`, `Esc`, backspace).
- File-log toggle writing per-session logs under `./data/replay-session-logs`.
- Responsive: narrow terminals (< 56 columns) stack vertically.

## Architecture

### The View contract

The failure mode for imperative TUI code is ad-hoc mutation scattered across
screens. One convention prevents it:

```ts
export interface View<P> {
  readonly root: Renderable;
  update(props: P): void;   // idempotent; assigns to setters
  destroy(): void;
}
export type Factory<P> = (ctx: RenderContext, initial: P) => View<P>;
```

Renderables are constructed **once** inside the factory. `update()` only
assigns to properties — Core dirty-tracks natively, so redundant assignment is
cheap and no conditional tree-building is needed. `destroy()` detaches from the
parent. Every widget is independently constructible, updatable, and testable.

### Composition

- **`ScreenRouter`** owns the phase-to-screen mapping. Exactly one screen is
  alive; transitions `destroy()` the outgoing screen.
- **`KeyRouter`** is a single table-driven dispatcher replacing the four
  scattered `useInput` blocks. Keybindings become data:
  `{ phase, key, label, run }`.
- **The help bar is generated from the keymap table.** Today `shortKeys()`
  hardcodes hint strings that can drift from the handlers that implement them;
  deriving both from one table removes that whole bug class.
- **Lists** use row pooling: a fixed pool of `TextRenderable`s whose `.content`
  is reassigned. This deletes the manual last-N-slice-plus-blank-padding logic
  that exists purely to satisfy Ink's fixed-height invariant.

### Module layout

```
src/replay/tui/
  view.ts          View contract + mount/destroy helpers
  app.ts           ScreenRouter + AppController wiring
  keymap.ts        keybinding table (drives dispatch AND help text)
  theme.ts         semantic tokens (colour strings -> RGBA)
  screens/         select.ts ready.ts convert.ts run.ts summary.ts
  widgets/         progressStrip.ts sessionList.ts logTail.ts
                   fileQueue.ts helpBar.ts idTagField.ts
```

### Preserved unchanged

`state.ts` (reducer), `batchLoop.ts`, `convertQueue.ts`, `format.ts`, and
everything outside `tui/` (`replayRunner`, `controller`, `events`, `plan`,
`connection`, `logConvert`). These are already framework-free — roughly 600
tested lines that the migration must not disturb. The `AppController` shape is
held constant so `index_replay_16_tui.ts` integration is unaffected.

### Deleted

- `altScreen.ts` — replaced by `screenMode: "alternate-screen"` plus
  `exitSignals` and `clearOnShutdown` on the renderer config.
- `Frame.tsx` fixed-height arithmetic and every blank-padding loop.
- `useTerminalSize` in `layout.ts` — replaced by the renderer `RESIZE` event.
  `fitText` is retained for strings composed before render.
- `ink`, `react`, `@types/react`, `ink-testing-library` dependencies.

## Redesign

| Screen | Change | Parity effect |
|---|---|---|
| `running` log pane | `ScrollBox`, sticky scroll, mouse wheel | Gain — currently an unscrollable 6-line window |
| `converting` | Real `Input` renderables | Gain — cursor movement, mid-string editing, paste |
| `complete` | `ScrollBox` | Parity; deletes manual scroll and clamp math |
| `selecting` | Pooled rows, mouse click | Parity |
| `ready` | Merged into `selecting` | Parity, conditional — see below |

**The `ready` merge.** `ready` becomes a persistent right-hand pane of
`selecting` rather than a separate mode. This is parity **only if** that pane
carries the per-file identity (cpId and masked auth source) that `ready` shows
today; that is a binding requirement on the implementation, not an optional
detail. Two consequences are accepted: the `e` (edit) keybinding retires because
"go back and edit" is no longer a mode change, and `autoBegin` transitions
directly from CLI arguments to `running`.

Visual direction: semantic tokens promoted to RGBA, a persistent header/status
bar shared by all screens, a visible focus ring on the active pane, and a
consistent one-column gutter.

## Testing

The migration improves determinism rather than merely preserving coverage.

- `createTestRenderer()` + `captureCharFrame()` replace `ink-testing-library`.
  Existing `.toContain(...)` assertions largely survive unchanged.
- `renderer.settle()` replaces `flushFrames()`'s `setTimeout(10)`, removing
  timing flakiness from every render test.
- The `View` contract enables true widget-level tests: construct, `update()`,
  assert the frame — with no app-level scaffolding.
- Pure-logic suites (`state.test.ts`, `batchLoop`, `convertQueue`) are untouched.
- Vitest requires `NODE_OPTIONS=--experimental-ffi`, set in the vitest config.

Render tests to rewrite: `App.test.tsx`, `App.batch.test.tsx`,
`App.convert.test.tsx`, `FileBrowser`, `FileQueue`, `SessionList`, `LogTail`,
`SummaryScreen`, `ConvertWizard`.

## Operations

- `package.json`: `"replay:16:tui": NODE_OPTIONS="--experimental-ffi" tsx index_replay_16_tui.ts`.
- **`@opentui/core` is pinned exactly (`"0.5.6"`, no caret).** Every finding in
  this document was verified against that release, and upstream runs no Node CI
  lane, so a patch release could silently change FFI loading behaviour. Upgrades
  are deliberate: bump the pin, re-run the TUI smoke test, then commit.
- OpenTUI writes a stray line to stderr on startup
  (`"FFI is an experimental feature and might change at any time"`) that
  survives `--disable-warning=ExperimentalWarning`. It must be suppressed or
  captured so it cannot corrupt the alternate screen.
- Volta pin stays at a Node version verified against the installed OpenTUI
  release; the working pair is recorded in the README.

## Risks

1. **`--experimental-ffi` is an unstable Node flag.** Its API may change across
   Node releases. Mitigation: pin Node via Volta; treat a Node upgrade as
   requiring a TUI smoke test.
2. **Unsupported configuration.** Upstream claims Node 26.4.0 exactly and runs
   no Node CI lane for its bindings. 26.1.0 is verified working here, but this
   pairing is not one upstream tests.
3. **No visual regression harness.** Parity is asserted by the capability
   checklist and frame-content assertions, not by screenshot diffing. The
   checklist above is therefore the acceptance gate.

## Out of scope

Other entrypoints (`index_16.ts`, `index_201.ts`, `index_21.ts`, stress
scripts) have no TUI and are untouched. OCPP protocol code, the admin API, and
the replay runner are unchanged.
