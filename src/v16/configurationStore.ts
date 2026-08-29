// Simple in-memory OCPP 1.6 configuration store for the VCP.
// GetConfiguration reads it, ChangeConfiguration writes it, and the admin API exposes it
// so the cockpit can show/edit the values "registered in the charge point".

export interface ConfigEntry {
  key: string;
  readonly: boolean;
  value: string;
}

const store: ConfigEntry[] = [
  {
    key: "SupportedFeatureProfiles",
    readonly: true,
    value: "Core,FirmwareManagement,LocalAuthListManagement,Reservation,SmartCharging,RemoteTrigger",
  },
  { key: "ChargeProfileMaxStackLevel", readonly: true, value: "99" },
  { key: "HeartbeatInterval", readonly: false, value: "300" },
  { key: "MeterValueSampleInterval", readonly: false, value: "60" },
  { key: "ConnectionTimeOut", readonly: false, value: "60" },
  { key: "GetConfigurationMaxKeys", readonly: true, value: "99" },
];

export function allConfiguration(): ConfigEntry[] {
  return store;
}

export function getConfiguration(keys?: string[] | null): {
  configurationKey: ConfigEntry[];
  unknownKey: string[];
} {
  if (!keys || keys.length === 0) {
    return { configurationKey: store, unknownKey: [] };
  }
  const configurationKey = store.filter((e) => keys.includes(e.key));
  const unknownKey = keys.filter((k) => !store.some((e) => e.key === k));
  return { configurationKey, unknownKey };
}

export type ChangeStatus = "Accepted" | "Rejected" | "NotSupported";

export function setConfiguration(key: string, value: string): ChangeStatus {
  const entry = store.find((e) => e.key === key);
  if (!entry) return "NotSupported";
  if (entry.readonly) return "Rejected";
  entry.value = value;
  return "Accepted";
}
