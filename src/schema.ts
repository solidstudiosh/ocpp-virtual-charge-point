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
    startChance: { type: "number" },
    testCharge: { type: "boolean" },
    duration: { type: "number" },
    randomDelay: { type: "boolean" },
    connectors: { type: "number" },
    ocppVersion: { type: "string" },
  },
};

export interface StartVcpRequestSchema {
  endpoint: string;
  chargePointId?: string;
  idPrefix?: string;
  count?: number;
  startChance: number;
  testCharge: boolean;
  duration: number;
  randomDelay: boolean;
  connectors: number;
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

export const LoginValidationSchema = {
  type: "object",
  required: ["email", "password"],
  properties: {
    email: { type: "string" },
    password: { type: "string" },
  },
};

export interface LoginRequestSchema {
  email: string;
  password: string;
}
