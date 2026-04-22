// ---------------------------------------------------------------------------
// Shared types and interfaces
// ---------------------------------------------------------------------------

export type OcppProtocol = "ocpp1.6" | "ocpp2.0.1";

export type StationState =
  | "connecting"
  | "available"
  | "preparing"
  | "charging"
  | "finishing"
  | "disconnected";

export interface ChargingSession {
  transactionId: number | string | null;
  idTag: string;
  meterStartWh: number;
  targetEnergyWh: number;
  currentEnergyWh: number;
  startedAt: number;
  durationMs: number;
  meterTimer: ReturnType<typeof setInterval> | null;
  seqNo: number; // for OCPP 2.0.1
}

export interface PendingCall {
  action: string;
  payload: unknown;
  resolve: (response: unknown) => void;
}

export interface Stats {
  sessionsCompleted: number;
  totalEnergyKwh: number;
  totalSessionDurationMs: number;
  sessionCount: number;
}

export interface Scenario {
  name: string;
  description: string;
  hotkey: string;
  /** When to trigger (seconds from start). "random" = random within first 10 minutes */
  triggerAt: number | "random";
  execute: (stations: Station[]) => void;
}

// Forward-declared interface so other modules can reference Station without circular deps
export interface Station {
  readonly id: string;
  readonly serial: string;
  readonly protocol: OcppProtocol;
  state: StationState;
  session: ChargingSession | null;
  destroyed: boolean;
  connect(): void;
  disconnect(intentional?: boolean): void;
  destroy(): void;
  startChargingSession(idTag?: string, connectorId?: number): void;
  stopChargingSession(reason: string): Promise<void>;
  tick(): void;
  disconnectCheck(): void;
}
