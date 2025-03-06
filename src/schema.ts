import { OcppVersion } from "./ocppVersion";

export interface StartVcpRequest {
  endpoint: string;
  chargePointId?: string;
  idPrefix?: string;
  count?: number;
  sleepTime?: number;
  startChance: number;
  testCharge: boolean;
  duration: number;
  randomDelay: boolean;
  isTwinGun: boolean;
  ocppVersion: OcppVersion;
}

export enum StatusNotification {
  Available = "Available",
  Charging = "Charging",
  Faulted = "Faulted",
  Finishing = "Finishing",
  Preparing = "Preparing",
  Reserved = "Reserved",
  SuspendedEV = "SuspendedEV",
  SuspendedEVSE = "SuspendedEVSE",
}

export enum SecurityEventNotification {
  StartupOfTheDevice = "StartupOfTheDevice",
  TamperDetectionActivated = "TamperDetectionActivated",
}

export enum AdminAction {
  Authorize = "Authorize",
  DataTransfer = "DataTransfer",
  SecurityEventNotification = "SecurityEventNotification",
  StatusNotification = "StatusNotification",
  MeterValues = "MeterValues",
  StartTransaction = "StartTransaction",
  StopTransaction = "StopTransaction",
}

export interface ChangeVcpStatusRequest {
  chargePointId: string;
  action: AdminAction;
  payload: object;
}

export interface StopVcpRequest {
  vcpId?: string;
  vcpIdPrefix?: string;
}
