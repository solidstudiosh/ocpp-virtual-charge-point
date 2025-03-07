import { OcppVersion } from "./ocppVersion";

export const StartVcpValidationSchema = {
  type: "object",
  required: [
    "endpoint",
    "ocppVersion",
    "startChance",
    "testCharge",
    "duration",
  ],
  properties: {
    endpoint: { type: "string" },
    chargePointId: { type: "string" },
    idPrefix: { type: "string" },
    count: { type: "integer" },
    sleepTime: { type: "integer" },
    startChance: { type: "number" },
    testCharge: { type: "boolean" },
    duration: { type: "number" },
    randomDelay: { type: "boolean" },
    isTwinGun: { type: "boolean" },
    ocppVersion: { type: "string" },
  },
};

export interface StartVcpRequestSchema {
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

export enum AdminAction {
  Authorize = "Authorize",
  DataTransfer = "DataTransfer",
  SecurityEventNotification = "SecurityEventNotification",
  StatusNotification = "StatusNotification",
  MeterValues = "MeterValues",
  StartTransaction = "StartTransaction",
  StopTransaction = "StopTransaction",
}

export interface ChangeVcpStatusRequestSchema {
  chargePointId: string;
  action: AdminAction;
  payload: object;
}

export const ChangeVcpStatusValidationSchema = {
  type: "object",
  required: ["chargePointId", "action", "payload"],
  properties: {
    chargePointId: { type: "string" },
    action: { type: "string" },
    payload: { type: "object" },
  },
};

export interface StopVcpRequestSchema {
  vcpId?: string;
  vcpIdPrefix?: string;
}

export const StopVcpValidationSchema = {
  type: "object",
  properties: {
    vcpId: { type: "string" },
    vcpIdPrefix: { type: "string" },
  },
};

export const StatusValidationSchema = {
  type: "object",
  properties: {
    verbose: { type: "boolean" },
  },
};

export interface StatusRequestSchema {
  verbose: boolean;
}
