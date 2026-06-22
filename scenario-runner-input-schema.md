# Scenario Runner — Input Data Schema

**For:** anyone preparing or consuming the JSON files the scenario runner takes as input. This document is the contract for that input — it covers **only how the data is structured**, not how the runner replays it.

---

## What this document covers

The runner's input is one JSON file per `stationId` (e.g. `data/sessions_replay/{stationId}.json`), each containing the charger-originated OCPP request frames recorded during a failed charging session. The data has already been filtered so that what remains is the minimum charger-originated request sequence:

- Sessions that never charged (no `MeterValues`) are removed.
- Sessions with no positive `Energy.Active.Import.Register` delta are removed.
- Sub-sessions whose rows have no `idTag` (can't be attributed to a customer) are removed.
- Server-originated frames like `RemoteStartTransaction` are removed (the charger doesn't send them).
- Response frames (`messageType` 3 / 4) are removed.
- Retries and redundant `StatusNotification` rows are collapsed.

---

## Top-level JSON

```json
{
  "stationId": "CS_TEST_2",
  "sessions": [
    { ... session 0 ... },
    { ... session 1 ... }
  ]
}
```

| Field        | Type        | Description                                                                                              |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------- |
| `stationId`  | string      | The OCPP station identifier (the `stationId` column from the source CSV; matches the JSON filename stem). |
| `sessions`   | array       | Zero or more `Session` objects — each is one failed-but-recoverable charging session on this station.    |

A single station can have multiple sessions across different connectors and timeframes; each is independent.

---

## Session schema

```json
{
  "connectorId": "1",
  "startSignal": {
    "kind": "Preparing",
    "timestamp": "2026-02-07T14:55:40.218000+00:00"
  },
  "endSignal": {
    "kind": "Available",
    "timestamp": "2026-02-07T15:53:26.263000+00:00"
  },
  "idTag": "RFID_TEST_1",
  "windowStart": "2026-02-07T14:55:40.218000+00:00",
  "windowEnd": "2026-02-07T15:53:26.263000+00:00",
  "messages": [
    { ... message 0 ... },
    ...
  ]
}
```

| Field          | Type            | Description                                                                                                                           |
| -------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `connectorId`  | string          | The connector this session ran on. Always a string in the JSON, but typically a small integer ("1", "2"). Matches the `connectorId` field in OCPP message bodies (where it's an integer). |
| `startSignal`  | object          | Why and when the session is considered to have started. See *Start-signal kinds* below.                                               |
| `endSignal`    | object          | Why and when the session is considered to have ended. See *End-signal kinds* below.                                                   |
| `idTag`        | string          | The RFID / authentication token associated with the session, resolved from the first row in the original event stream that carried a non-empty `idTag`. Always non-empty. |
| `windowStart`  | ISO-8601 string | Same as `startSignal.timestamp`. Retained for backward compatibility with consumers of older outputs.                                 |
| `windowEnd`    | ISO-8601 string | Same as `endSignal.timestamp`. Retained for backward compatibility.                                                                   |
| `messages`     | array           | Chronologically ordered list of OCPP request frames (see *Message schema* below). At least one entry per session.                     |

### Start-signal kinds

| `startSignal.kind`     | OCPP 1.6                                                            | OCPP 2.0.1                                |
| ---------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| `Preparing`            | `StatusNotification` with `status=Preparing` — primary start signal | (not produced for 2.0.1 stations)         |
| `Charging`             | `StatusNotification` with `status=Charging` (fallback when no Preparing was observed) | (not produced for 2.0.1 stations) |
| `StartTransaction`     | A `StartTransaction` request arrived in idle state                  | (not produced for 2.0.1 stations)         |
| `OrphanMV`             | A `MeterValues` request arrived in idle state                       | (not produced for 2.0.1 stations)         |
| `TxEvStarted`          | (not produced for 1.6 stations)                                     | `TransactionEvent(eventType=Started)`     |

### End-signal kinds

| `endSignal.kind`       | Meaning                                                                                       | OCPP version |
| ---------------------- | --------------------------------------------------------------------------------------------- | ------------ |
| `StopTransaction`      | A `StopTransaction` request closed the session.                                               | 1.6          |
| `Available`            | A `StatusNotification` with `status=Available` closed the session.                            | 1.6          |
| `Unavailable`          | A `StatusNotification` with `status=Unavailable` closed the session.                          | 1.6          |
| `ImplicitNewStart`     | A new `StatusNotification(Preparing)` arrived while the prior session was still open. The prior session closes at the timestamp of its last in-session event (NOT at the new Preparing). | 1.6 |
| `Timeout`              | More than 30 minutes elapsed without any new event on the connector. End timestamp is the last in-session event's timestamp. | 1.6 + 2.0.1 |
| `FaultedTimeout`       | Same as `Timeout`, but the last in-session event was a `Faulted` `StatusNotification`. The Faulted is preserved in `messages`. | 1.6 |
| `EndOfData`            | The CSV stream ended with the session still open. This typically means the session was actually still in progress at the end of the export window. | 1.6 + 2.0.1 |
| `TxEvEnded`            | A `TransactionEvent(eventType=Ended)` closed the session.                                     | 2.0.1        |

`endSignal.timestamp` is either (a) the timestamp of the closing event itself for hard ends (`StopTransaction`, `Available`, `Unavailable`, `TxEvEnded`), or (b) the timestamp of the last in-session event for "soft" ends (`ImplicitNewStart`, `Timeout`, `FaultedTimeout`, `EndOfData`).

---

## Message schema

Each entry in `messages` is one OCPP request frame the charger originally sent.

```json
{
  "id": "1001",
  "timestamp": "2026-02-07T14:55:40.218Z",
  "action": "StatusNotification",
  "messageType": "2",
  "messageId": "100",
  "idTag": "",
  "body": {
    "connectorId": 1,
    "errorCode": "NoError",
    "status": "Preparing"
  }
}
```

| Field           | Type    | Description                                                                                                                            |
| --------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string  | Internal database row ID from the source CSV. Useful only for tracing back to the original log line.                                   |
| `timestamp`     | string  | ISO-8601, UTC, with millisecond precision. The wall-clock time the original frame was received by the central system. **Note:** this is the *receiving* time, not the time inside the payload's `timestamp` field. |
| `action`        | string  | The OCPP action name — e.g. `StartTransaction`, `MeterValues`, `StatusNotification`, `Authorize`, `BootNotification`, `StopTransaction`, `TransactionEvent`. See *Action enum* below. |
| `messageType`   | string  | Always `"2"` (Call/request). The output never contains responses. |
| `messageId`     | string  | The OCPP correlator the original charger used. |
| `idTag`         | string  | The CSV column value (often empty for SN/MV/Boot rows; populated for ST/Authorize/Stop). For the actual idTag inside the OCPP body, look at `body.idTag` (1.6) or `body.idToken.idToken` (2.0.1). |
| `body`          | object \| string | The parsed OCPP message body — i.e. the inner `{}` from the original `[2 "msgId" "Action" {...body}]` frame. Already JSON-decoded. In rare cases where parsing the original payload failed, this is a string with the raw payload; treat that as a corrupt row. |

### Action enum

The `messages` array contains only these action names:

| Action                  | Direction      | OCPP version | Purpose                                                  |
| ----------------------- | -------------- | ------------ | -------------------------------------------------------- |
| `Authorize`             | charger → CPMS | 1.6          | Pre-session card-swipe authentication.                   |
| `BootNotification`      | charger → CPMS | 1.6          | Charger boot event. Usually one per power-on, occasionally observed mid-session-window if the charger rebooted. |
| `StartTransaction`      | charger → CPMS | 1.6          | Begin a charging transaction. The first frame the charger sends after a successful Authorize. |
| `StopTransaction`       | charger → CPMS | 1.6          | End a charging transaction. Includes `transactionId`, `meterStop`, `timestamp`. In failed-session data, `transactionId` is typically `-1` (the charger never received a real one from the backend). |
| `MeterValues`           | charger → CPMS | 1.6          | Periodic meter readings during charging. Multiple per session — this is the time-series data. |
| `StatusNotification`    | charger → CPMS | 1.6          | Connector state transitions: `Preparing`, `Charging`, `Finishing`, `SuspendedEV`, `SuspendedEVSE`, `Faulted`, `Available`, `Unavailable`. |
| `TransactionEvent`      | charger → CPMS | 2.0.1        | Combined lifecycle frame for OCPP 2.0.1 (`eventType` ∈ {`Started`, `Updated`, `Ended`}); replaces ST/StopTx/MV. |

Server-originated actions (`RemoteStartTransaction`, `RemoteStopTransaction`, `ChangeConfiguration`, etc.) are **not** present in this data by design.

---

## OCPP version differences in the data

The two OCPP versions have **different message vocabularies**:

| Concern                  | OCPP 1.6                                                   | OCPP 2.0.1                                                 |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Session start            | `StatusNotification(Preparing)` or fallback                 | `TransactionEvent(eventType=Started)`                      |
| In-session readings      | `MeterValues`                                              | `TransactionEvent(eventType=Updated)`                      |
| Session end              | `StopTransaction`                                          | `TransactionEvent(eventType=Ended)`                        |
| Authentication           | `Authorize`                                                | usually embedded in `TransactionEvent` via `idToken`       |
| State transitions        | `StatusNotification` with `status=...`                     | (not used in this dataset)                                 |
| `idTag` location in body | `body.idTag` (string)                                      | `body.idToken.idToken` (string), `body.idToken.type` (string, e.g. `ISO14443`) |

The data does not tag the OCPP version explicitly. The simplest detection: check whether the first session's first message has `action == 'TransactionEvent'`; if yes, it's 2.0.1; otherwise it's 1.6.

---

## Data notes and gotchas

### `transactionId: -1` in `StopTransaction`

In failed-session data, the original charger never received a `transactionId` from the backend, so its `StopTransaction.body.transactionId` is `-1`. The same can apply to `MeterValues.body.transactionId` (some 1.6 implementations omit it on failed sessions).

### Reused `messageId` values

Some chargers cycle short numeric `messageId` values (e.g. `CS_TEST_3` reuses 1000–1136). The stored `messageId` is not guaranteed unique even within a single session.

### Comma-stripped JSON in original payloads

Some original payloads used a non-standard JSON serialization that omitted commas between key-value pairs. This is already normalized — `message.body` is always proper JSON.

### Empty `idTag` on the row-level field

`message.idTag` (the CSV-column value) can be empty for actions like `StatusNotification` and `MeterValues`. The session-level `idTag` (top of the session object) is always non-empty and reflects the canonical RFID for the session.

### `Faulted` rows preserved despite being mid-session

If the original session had a `Faulted` `StatusNotification` that was later recovered (Charging followed within 30 min) or superseded by a definitive end signal (Stop / Available), the `Faulted` row is kept in `messages`.

### Sessions with `endSignal.kind == EndOfData`

These sessions were still in progress when the original CSV export window ended. `endSignal.timestamp` points to the last in-session event, not a true session close.

---

## Worked example

An illustrative session (all values are synthetic; some MeterValues elided for brevity):

```json
{
  "connectorId": "1",
  "startSignal": {
    "kind": "Preparing",
    "timestamp": "2026-02-07T14:55:40.218000+00:00"
  },
  "endSignal": {
    "kind": "Available",
    "timestamp": "2026-02-07T15:53:26.263000+00:00"
  },
  "idTag": "RFID_TEST_1",
  "windowStart": "2026-02-07T14:55:40.218000+00:00",
  "windowEnd": "2026-02-07T15:53:26.263000+00:00",
  "messages": [
    {
      "id": "1001",
      "timestamp": "2026-02-07T14:55:40.218Z",
      "action": "StatusNotification",
      "messageType": "2",
      "messageId": "100",
      "idTag": "",
      "body": { "connectorId": 1, "errorCode": "NoError", "status": "Preparing" }
    },
    {
      "id": "1002",
      "timestamp": "2026-02-07T14:56:28.812Z",
      "action": "StartTransaction",
      "messageType": "2",
      "messageId": "101",
      "idTag": "RFID_TEST_1",
      "body": {
        "timestamp": "2026-02-07T14:56:24Z",
        "connectorId": 1,
        "meterStart": 100000,
        "idTag": "RFID_TEST_1"
      }
    },
    {
      "id": "1003",
      "timestamp": "2026-02-07T14:56:32.165Z",
      "action": "StatusNotification",
      "messageType": "2",
      "messageId": "102",
      "idTag": "",
      "body": { "connectorId": 1, "errorCode": "NoError", "status": "SuspendedEVSE" }
    },
    "...many MeterValues frames as charging proceeds...",
    {
      "id": "1004",
      "timestamp": "2026-02-07T15:53:26.263Z",
      "action": "StatusNotification",
      "messageType": "2",
      "messageId": "103",
      "idTag": "",
      "body": { "connectorId": 1, "errorCode": "NoError", "status": "Available" }
    }
  ]
}
```

The session opened with the EV plug-in (`Preparing`), the charger sent `StartTransaction`, the connector transitioned through `SuspendedEVSE` / `Charging` / `Finishing` (with periodic `MeterValues` interspersed), and finally a `StatusNotification(Available)` closed the session. A typical real session has on the order of a couple hundred messages total — predominantly `MeterValues` readings.
