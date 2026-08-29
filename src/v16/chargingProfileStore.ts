// In-memory store of the smart-charging profiles the CSMS pushed to the VCP.
// SetChargingProfile writes here, ClearChargingProfile clears, and the admin API exposes the
// active limit so the cockpit's charge engine can throttle the simulated power live.

export interface ActiveProfile {
  connectorId: number;
  limit: number; // amps if unit === "A", watts if "W"
  unit: "A" | "W";
  stackLevel: number;
  purpose: string;
}

// keyed by connectorId (0 = station-wide, applies to every connector)
const profiles = new Map<number, ActiveProfile>();

// biome-ignore lint/suspicious/noExplicitAny: ocpp payload
export function setProfile(connectorId: number, csChargingProfiles: any): void {
  const schedule = csChargingProfiles?.chargingSchedule;
  const period = schedule?.chargingSchedulePeriod?.[0];
  if (!period) return;
  profiles.set(connectorId, {
    connectorId,
    limit: Number(period.limit),
    unit: schedule.chargingRateUnit,
    stackLevel: csChargingProfiles.stackLevel ?? 0,
    purpose: csChargingProfiles.chargingProfilePurpose ?? "TxDefaultProfile",
  });
}

export function clearProfile(connectorId?: number | null): void {
  if (connectorId == null) profiles.clear();
  else profiles.delete(connectorId);
}

export function allProfiles(): ActiveProfile[] {
  return Array.from(profiles.values());
}

// Connector-specific profile wins, else the station-wide (connectorId 0) one, else none.
export function activeLimitFor(connectorId: number): ActiveProfile | null {
  return profiles.get(connectorId) ?? profiles.get(0) ?? null;
}
