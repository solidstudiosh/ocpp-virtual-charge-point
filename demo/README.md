# OCPP Network Simulator

A scalable OCPP charge point network simulator that creates thousands of virtual charging stations, each maintaining a WebSocket connection and performing realistic charging sessions.

## What it does

- Spawns N virtual charge points (default 2000), 70% OCPP 1.6 and 30% OCPP 2.0.1
- Each station connects via WebSocket, sends BootNotification, heartbeats, and status updates
- Stations randomly start/stop charging sessions with realistic meter values (energy, power, voltage, current, SoC)
- Random disconnections simulate network instability
- Predefined **scenarios** simulate real-world events (blackouts, peak hours, rolling restarts, etc.)
- Interactive hotkeys let you trigger scenarios at runtime

## How to run

### Basic (2000 stations, default settings)

```bash
npx tsx demo/simulate-network.ts
```

### Scaled down (for local development)

```bash
STATION_COUNT=10 CHARGE_PROBABILITY=0.3 SESSION_MIN_MINUTES=1 SESSION_MAX_MINUTES=3 npx tsx demo/simulate-network.ts
```

### With scheduled scenarios

```bash
SCENARIOS=blackout:120,peak-hour:300 npx tsx demo/simulate-network.ts
```

### With debug logging

```bash
LOG_LEVEL=debug STATION_COUNT=5 npx tsx demo/simulate-network.ts
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_URL` | `ws://localhost:3000` | WebSocket URL of the OCPP server |
| `STATION_COUNT` | `2000` | Number of virtual charge points |
| `CHARGE_PROBABILITY` | `0.05` | Probability of starting a session per 30s tick (0-1) |
| `DISCONNECT_PROBABILITY` | `0.01` | Probability of random disconnect per minute (0-1) |
| `SESSION_MIN_MINUTES` | `2` | Minimum charging session duration (real minutes) |
| `SESSION_MAX_MINUTES` | `10` | Maximum charging session duration (real minutes) |
| `LOG_LEVEL` | `info` | `info` or `debug` (debug shows every OCPP message) |
| `SCENARIOS` | _(empty)_ | Comma-separated `name:seconds` pairs for scheduled scenarios |

## Interactive hotkeys

Press these keys during runtime:

| Key | Scenario | Description |
|-----|----------|-------------|
| `b` | blackout | All stations disconnect, reconnect after 30-60s |
| `p` | peak-hour | Charging probability jumps to 80% for 5 minutes |
| `t` | target-failover | 20% of stations disconnect and reconnect (server restart) |
| `r` | rolling-restart | Stations restart one by one with 100ms delay (firmware update) |
| `n` | idle-night | Charging probability drops to 1% for 5 minutes |
| `s` | surge | 500 new stations connect within 10 seconds |
| `h` / `?` | — | Show hotkey help |
| `q` | — | Graceful shutdown |

## Integration with OCPP proxy demo

This simulator is designed to work with the OCPP proxy from `base-emobility-ocpp-proxy`. To run a full demo:

```bash
# 1. Start the proxy (in base-emobility-ocpp-proxy)
cd ../base-emobility-ocpp-proxy/demo
docker compose up -d

# 2. Run the simulator against the proxy
cd ../../ocpp-virtual-charge-point
WS_URL=ws://localhost:3000 STATION_COUNT=100 npx tsx demo/simulate-network.ts
```

## Example output

```
=== OCPP Network Simulator ===
  Target:       ws://localhost:3000
  Stations:     100 (70 OCPP 1.6, 30 OCPP 2.0.1)
  Charge prob:  5% per 30s tick
  Disconnect:   1% per minute
  Session time: 2-10 min (real)
  Log level:    info
  Stagger:      0-180s per station

=== Interactive Hotkeys ===
  b — blackout: All stations disconnect simultaneously, reconnect after 30-60s (power outage)
  p — peak-hour: Charging probability jumps to 80% for 5 minutes (rush hour)
  ...

Staggering 100 station connections over 180s...

[12:00:15] [SIM-0023] Started charging (RFID-AA07, target: 45.2 kWh, 6.3 min)
[12:00:30] Connected: 42/100 | Charging: 3 | Available: 39 | Preparing/Finishing: 0 | Disconnected: 58 | Sessions: 0 | Energy: 0.0 kWh
[12:00:45] [SIM-0023] Stopped charging (45.2 kWh, 6.3 min, reason: Local)
```

## Architecture

```
demo/
├── simulate-network.ts  — Main entry point (wires modules, timers, shutdown)
├── station.ts           — Station class (WebSocket, OCPP boot/heartbeat, message routing)
├── charging.ts          — Charging session lifecycle (start, meter values, stop for 1.6 & 2.0.1)
├── scenarios.ts         — Predefined scenarios, env scheduling, interactive keyboard input
├── stats.ts             — ANSI colors, logging helpers, statistics tracking & display
├── config.ts            — Environment variable parsing, RFID pool, random helpers
├── types.ts             — Shared TypeScript types and interfaces
└── README.md            — This file
```

### Module dependencies

```
simulate-network.ts
  ├── config.ts
  ├── station.ts
  │   ├── config.ts
  │   ├── charging.ts
  │   │   ├── config.ts
  │   │   ├── stats.ts
  │   │   └── types.ts
  │   ├── stats.ts
  │   └── types.ts
  ├── stats.ts
  │   ├── config.ts
  │   └── types.ts
  ├── scenarios.ts
  │   ├── config.ts
  │   ├── station.ts
  │   ├── stats.ts
  │   └── types.ts
  └── types.ts
```
