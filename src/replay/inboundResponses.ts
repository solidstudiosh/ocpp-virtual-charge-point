const REJECTED = { status: "Rejected" } as const;
const NOT_IMPLEMENTED = { status: "NotImplemented" } as const;

const TABLE: Record<string, unknown> = {
  RemoteStartTransaction: REJECTED,
  RemoteStopTransaction: REJECTED,
  ChangeConfiguration: REJECTED,
  ChangeAvailability: REJECTED,
  ClearCache: REJECTED,
  Reset: REJECTED,
  UnlockConnector: REJECTED,
  ReserveNow: REJECTED,
  CancelReservation: REJECTED,
  SendLocalList: REJECTED,
  SetChargingProfile: REJECTED,
  ClearChargingProfile: REJECTED,
  GetCompositeSchedule: REJECTED,
  TriggerMessage: NOT_IMPLEMENTED,
  ExtendedTriggerMessage: NOT_IMPLEMENTED,
  DataTransfer: REJECTED,
  GetDiagnostics: { status: "NotImplemented" },
  UpdateFirmware: {},
  CertificateSigned: REJECTED,
  DeleteCertificate: REJECTED,
  GetInstalledCertificateIds: { status: "NotFound" },
  InstallCertificate: REJECTED,
  GetLog: { status: "Rejected" },
  GetConfiguration: { configurationKey: [], unknownKey: [] },
  GetLocalListVersion: { listVersion: 0 },
  SignedUpdateFirmware: { status: "Rejected" },
};

export function rejectionResponseFor(action: string): unknown | null {
  return action in TABLE ? TABLE[action] : null;
}
