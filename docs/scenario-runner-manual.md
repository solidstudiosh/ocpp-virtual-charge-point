# Replay Mode — User Manual

Replay historical OCPP 1.6 sessions against a real CPMS, acting as a virtual
charge point. Useful for reproducing production incidents, regression‑testing
CPMS changes, or load‑testing with realistic traffic.

> The on‑disk shape is documented in
> [`scenario-runner-input-schema.md`](../scenario-runner-input-schema.md) — this manual covers
> only how to *run* the replay.

---

## 1. Quick start

```bash
# Single station
WS_URL=wss://cpms.example.com/ocpp \
PASSWORD=secret \
npm run replay:16 -- path/to/CS_TEST_1.json
```

The runner connects as `stationId` from the JSON, replays every session in
order, then exits.

A typical successful run prints:

```
replay_started sid=CS_TEST_1 sessions=12
session_start sid=... cid=1 idTag=... windowStart=...
session_done  sid=... cid=1
…
replay_complete sid=CS_TEST_1 duration=PT47.812051203S durationMs=47812.051 succeeded=12 rejected=0 exitCode=0
```

---

## 2. Prerequisites

| Requirement | Notes                                                                  |
| ----------- | ---------------------------------------------------------------------- |
| Node ≥ 24   | Node 26 uses native `Temporal`; older Node falls back to the polyfill. |
| `npm i`     | Installs dependencies including the Temporal polyfill.                 |
| Replay JSON | Per‑station file from `data/sessions_replay/{stationId}.json`.         |
| CPMS URL    | A reachable OCPP 1.6 endpoint that knows about the station.            |

The CPMS must have the station provisioned (or accept it on first
`BootNotification`) and accept the `idTag`s referenced by each session.

---

## 3. Invocation

### npm script

```bash
npm run replay:16 -- <path-to-replay.json>
```

The `--` separates the path from npm's own arg parsing.

### Direct

```bash
npx tsx index_replay_16.ts <path-to-replay.json>
```

### From env only

```bash
REPLAY_FILE=path/to/file.json npm run replay:16
```

---

## 4. Configuration

All settings come from environment variables. `.env` is auto‑loaded.

| Variable                       | Default                          | Purpose                                              |
| ------------------------------ | -------------------------------- | ---------------------------------------------------- |
| `WS_URL`                       | `ws://localhost:3000`            | OCPP 1.6 WebSocket endpoint.                         |
| `PASSWORD`                     | —                                | HTTP Basic auth password (optional).                 |
| `CP_ID`                        | from JSON `stationId`            | Override the charge‑point ID used in the URL path.   |
| `REPLAY_FILE`                  | (CLI arg)                        | Path to the replay JSON if not passed on the CLI.    |
| `REPLAY_REJECTIONS_LOG`        | `./data/replay-rejections.log`   | Path to the JSONL rejection log.                     |
| `REPLAY_RUNS_LOG`              | `./data/replay-runs.log`         | Path to the JSONL per‑run summary log.               |
| `REPLAY_RESPONSE_TIMEOUT_MS`   | `30000`                          | Per‑message ack timeout.                             |

---

## 5. Lifecycle

For each invocation the runner performs:

1. **Connect** — opens the WebSocket to `WS_URL`, using `stationId` (or
   `CP_ID`) as the charge point identifier.
2. **Synthetic bootstrap** — sends one `BootNotification` and one
   `StatusNotification(connectorId=0, Available)`. If `BootNotification`
   is not `Accepted` the run aborts with exit code 2.
3. **Per‑session replay** — for every session in the file:
   - Logs `session_start`.
   - Sends each captured request in order, applying substitutions (§6).
   - Synthesises a closing `StopTransaction` based on `windowEnd` and the
     last `MeterValues` reading.
   - On success, logs `session_done`; on failure, writes a rejection
     record (§8) and continues with the next session.
4. **Close + summary** — closes the socket, writes a one‑line run summary
   (§8) and prints `replay_complete` with the total elapsed time
   (Temporal‑backed, sub‑millisecond precision).

Only the seven actions actually emitted by chargers are sent:
`BootNotification`, `StatusNotification`, `Authorize`, `StartTransaction`,
`MeterValues`, `StopTransaction`, `Heartbeat`. Any other action in the
input file is skipped with a warning.

---

## 6. Substitution rules

Captured frames carry the original `transactionId` from the source CPMS,
which the new CPMS does not know. The runner rewrites a few fields on the
fly:

| Field                          | Source of truth at replay time                                          |
| ------------------------------ | ----------------------------------------------------------------------- |
| `transactionId` (MV / Stop)    | `StartTransaction.conf.transactionId` returned by the live CPMS.        |
| `connectorId`                  | `session.connectorId`.                                                  |
| `idTag`                        | `session.idTag`.                                                        |
| Synthetic `StopTransaction`    | `meterStop` = highest seen `Energy.Active.Import.Register` Wh value.    |

If a `MeterValues` or `StopTransaction` would be sent without a usable
`transactionId` (e.g. `StartTransaction` was never accepted), the session
is rejected with reason `missing_transaction_id` and the runner moves on.

---

## 7. Server‑initiated messages

Replay is **read‑only**. Any `RemoteStartTransaction`, `Reset`,
`ChangeConfiguration`, `TriggerMessage`, etc. that the CPMS sends *to* the
VCP is auto‑rejected with a `CallError`. The replay never enters a
remotely controlled state.

---

## 8. Outputs

All output files are JSONL (one JSON object per line). Files are
appended to — multi‑station orchestration over many invocations keeps
adding rows.

### 8.1 Rejections — `data/replay-rejections.log`

One record per failed session.

```json
{
  "ts": "2026-05-20T10:42:56.512Z",
  "stationId": "CS_TEST_1",
  "connectorId": "1",
  "windowStart": "...",
  "windowEnd": "...",
  "idTag": "...",
  "failedAt": { "action": "StartTransaction", "messageIndex": 3 },
  "reason": "id_tag_not_accepted",
  "details": { "status": "Blocked" }
}
```

`reason` is one of: `call_error`, `id_tag_not_accepted`, `timeout`,
`schema_invalid`, `missing_transaction_id`, `unknown_action`,
`synthetic_stop_failed`.

### 8.2 Per‑run summary — `data/replay-runs.log`

One record per invocation (i.e. per station).

```json
{
  "ts": "2026-05-20T10:42:56.514Z",
  "stationId": "CS_TEST_1",
  "sessionsTotal": 12,
  "sessionsSucceeded": 12,
  "sessionsRejected": 0,
  "durationMs": 47812.051,
  "durationIso": "PT47.812051203S",
  "exitCode": 0
}
```

`durationMs` and `durationIso` describe the same wall‑clock interval
measured with `Temporal.Now.instant()`. `durationIso` is ISO‑8601 (e.g.
`PT1M3.4S` for 63.4 s) and is the canonical representation; `durationMs`
is kept for tools that want a numeric value.

### 8.3 Console output

Key lines, all `logger.info` (Winston):

```
replay_started   sid=<id> sessions=<n>
session_start    sid=<id> cid=<n> idTag=<tag> windowStart=<iso>
session_done     sid=<id> cid=<n>
session_rejected sid=<id> cid=<n> reason=<reason>   (warn)
replay_complete  sid=<id> duration=<iso> durationMs=<ms> succeeded=<n> rejected=<n> exitCode=<code>
```

`LOG_LEVEL=debug` adds raw OCPP wire traffic.

---

## 9. Exit codes

| Code | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| `0`  | At least one session succeeded.                                               |
| `1`  | All sessions were rejected (still a "clean" run — useful for batch scripts). |
| `2`  | Run aborted — bootstrap failed, connection error, or unexpected exception.    |
| `3`  | Invalid invocation (e.g. missing replay file path).                           |

---

## 10. Multi‑station orchestration

The runner is intentionally one‑shot. Drive batches with a shell loop:

```bash
for f in data/sessions_replay/*.json; do
  npm run replay:16 -- "$f" || echo "run failed: $f"
done
```

After a batch, the timing of each station is in
`data/replay-runs.log`. To find the slow ones:

```bash
jq -r '[.stationId, .durationMs, .sessionsTotal] | @tsv' \
  data/replay-runs.log | sort -k2 -n
```

Total replay time across the batch:

```bash
jq -s 'map(.durationMs) | add / 1000 | "\(.)s"' data/replay-runs.log
```

---

## 11. Troubleshooting

| Symptom                                       | Likely cause / check                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `bootstrap failed` → exit code 2              | CPMS rejected `BootNotification`, or wrong `WS_URL` / `PASSWORD` / `CP_ID`.          |
| Every session ends with `id_tag_not_accepted` | RFID tags aren't provisioned on the target CPMS. Provision tokens or pick a station whose `idTag`s exist. |
| `missing_transaction_id` rejections           | The CPMS returned a `StartTransaction.conf` without a numeric `transactionId`, or `StartTransaction` itself was rejected. |
| `timeout` rejections                          | CPMS is slow or stalled; raise `REPLAY_RESPONSE_TIMEOUT_MS`.                         |
| `replay_complete` never prints                | The process was killed mid‑run; the `finally` block still writes a run summary — check `data/replay-runs.log`. |
| Wildly long `durationMs`                      | Usually CPMS latency, not the runner. Cross‑check with `LOG_LEVEL=debug` traces.     |

---

## 12. Where to look in the code

| File                                          | Role                                                                |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `index_replay_16.ts`                          | CLI entry point — parses args, calls `runReplay`.                   |
| `src/replay/replayRunner.ts`                  | Orchestration: bootstrap → per‑session loop → summary.              |
| `src/replay/replayMessageHandler.ts`          | Auto‑rejects server‑initiated calls.                                |
| `src/replay/substitution.ts`                  | `transactionId` rewrite and synthetic `StopTransaction` builder.    |
| `src/replay/rejectionLog.ts` / `runLog.ts`    | JSONL writers.                                                      |
| `src/replay/temporalCompat.ts`                | Native `Temporal` with polyfill fallback for older Node.            |
| `src/replay/__tests__/`                       | Vitest integration tests — happy path + rejection paths.            |

---

## 13. Interactive TUI mode

For an interactive dashboard view of the same run, use:

```bash
WS_URL=wss://cpms.example.com/ocpp \
PASSWORD=secret \
npm run replay:16:tui -- path/to/CS_TEST_1.json
```

It accepts the **same CLI surface** as `replay:16` (paths, directories,
`--id-tag=`, env vars). The difference is purely presentational:

- A header strip shows endpoint, station ID and elapsed time.
- A batch panel appears when ≥2 files are given, with per-file
  succeeded/rejected counts.
- A scrolling sessions panel shows every session with a status icon
  (· pending / ▶ running / ✓ done / ✗ rejected, plus the rejection reason).
- A status bar at the bottom shows current action + a spinner.
- A log tail shows the last 8 Winston lines.
- On exit, a final summary box prints — exit code, totals, ISO duration.

Caveats:

- Best with a unicode-capable terminal (border characters, spinner).
  Plain dumb terminals will get garbled output — use `replay:16` instead.
- `LOG_LEVEL=debug` floods the log tail; cap it via the env if needed.
- Ctrl+C exits cleanly. The current file finishes its own teardown but
  no further files are started.

### Mid-run controls (TUI only)

While a run is in flight, the following keys are active:

| Key | Action |
|-----|--------|
| `s` | Stop the current session now — sends a synthetic `StopTransaction` using the last seen `Energy.Active.Import.Register` value. Session is marked **truncated**, runner advances to the next session. |
| `p` | Pause/resume. Pausing takes effect between messages; the in-flight message completes first. No traffic on the wire while paused (no synthetic Heartbeats). |
| `a` | Abort. Truncates the current session (same as `s`), then exits the entire batch. Exit code `4`. |
| `?` | Toggle the help panel. |

A session truncated via `s` is **not** written to `data/replay-rejections.log` — truncation is a deliberate operator action, not a rejection. It is counted under the new `sessionsTruncated` field in `data/replay-runs.log`:

```json
{
  "stationId": "CS_TEST_1",
  "sessionsTotal": 12,
  "sessionsSucceeded": 10,
  "sessionsRejected": 1,
  "sessionsTruncated": 1,
  "durationIso": "PT47.812051203S",
  "exitCode": 0
}
```

If `s` is pressed before a session's `StartTransaction` is accepted (so no `transactionId` was ever captured), the synthetic `StopTransaction` is silently skipped — the session is still marked truncated, the runner moves on.

`Ctrl+C` still hard-kills the process without a synthetic Stop. It is the escape hatch when even `a` (abort) hangs.

Exit codes are extended with one new value:

| Code | Meaning |
|------|---------|
| `0` | At least one session succeeded (existing) |
| `1` | All sessions rejected (existing) |
| `2` | Bootstrap or connection failure (existing) |
| `3` | Invalid invocation (existing) |
| `4` | Clean abort via the `a` hotkey (new) |

If the terminal does not support raw mode (e.g., output piped to a file or run in CI), hotkeys are silently disabled and the dashboard still renders. Use the plain `replay:16` mode for non-interactive batch runs.

### Converting raw OCPP log exports (TUI only)

The TUI also accepts **raw OCPP log exports** — a JSON array of
`{"timestamp": "...", "payload": "..."}` entries (newest-first, with
response frames and server-originated calls included) — and converts them to
scenario files on the fly.

Select the log file in the file browser and press `B`. For each raw log in
the selection a conversion form appears:

- **stationId** — prefilled from the filename (a trailing `_ocpp_logs` is
  stripped); edit freely.
- **password** — optional per-file basic-auth password.
- **timestamps** — `rebase to now` (default) shifts the whole timeline so the
  last `StopTransaction` lands at the moment of conversion, preserving the
  original spacing between messages; `keep original` leaves every timestamp as
  recorded. Broken body timestamps (e.g. epoch zero) are never rewritten.

On accept the converted file is written next to the source as
`<stem>_scenario.json` (the source is never modified; an existing output is
overwritten) and replaces the raw log in the run queue. Frames the scenario
format excludes (responses, `RemoteStartTransaction`, …) are dropped; each
`StartTransaction`…`StopTransaction` span becomes one session. A log with no
`StartTransaction` cannot be converted and is dropped from the run after a
notice.

Non-interactive runs (`npm run replay:16:tui -- file.json` without `--pick`)
do **not** convert; they log a warning and the file is skipped by the runner
as unparseable. Use `--pick` to force the selection screen.
