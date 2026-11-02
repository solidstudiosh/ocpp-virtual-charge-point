/**
 * The OCPP 1.2 SOAP messages as the WSDLs define them (CentralSystemService
 * and ChargePointService, 2010/08 and 2010/10): element names, wire order,
 * cardinality and the XML types the codec has to convert. 2010/10 is 2010/08
 * plus the optional RemoteStartTransaction connectorId (spec §6.22, §8.8).
 */

export type Ocpp12Namespace = "2010_08" | "2010_10";

export const OCPP12_NAMESPACES: readonly Ocpp12Namespace[] = [
  "2010_08",
  "2010_10",
];

export type Ocpp12Service = "Cs" | "Cp";

export const serviceNamespace = (
  service: Ocpp12Service,
  namespace: Ocpp12Namespace,
): string => `urn://Ocpp/${service}/${namespace.replace("_", "/")}/`;

/** SOAP fault subcodes live here whatever the WSDL generation (spec §8.2). */
export const FAULT_SUBCODE_NAMESPACE = "urn://Ocpp/2010/08/";

export type ScalarType = "string" | "int" | "dateTime" | "anyURI";

export interface ComplexType {
  name: string;
  fields: Field[];
}

export interface Field {
  name: string;
  type: ScalarType | ComplexType;
  optional?: boolean;
  repeated?: boolean;
  /** Only written and read in this namespace. */
  only?: Ocpp12Namespace;
}

export interface Operation {
  action: string;
  service: Ocpp12Service;
  request: Field[];
  response: Field[];
}

const IdTagInfo: ComplexType = {
  name: "IdTagInfo",
  fields: [
    { name: "status", type: "string" },
    { name: "expiryDate", type: "dateTime", optional: true },
    { name: "parentIdTag", type: "string", optional: true },
  ],
};

const MeterValue: ComplexType = {
  name: "MeterValue",
  fields: [
    { name: "timestamp", type: "dateTime" },
    { name: "value", type: "int" },
  ],
};

const centralSystemOperations: Operation[] = [
  {
    action: "Authorize",
    service: "Cs",
    request: [{ name: "idTag", type: "string" }],
    response: [{ name: "idTagInfo", type: IdTagInfo }],
  },
  {
    action: "StartTransaction",
    service: "Cs",
    request: [
      { name: "connectorId", type: "int" },
      { name: "idTag", type: "string" },
      { name: "timestamp", type: "dateTime" },
      { name: "meterStart", type: "int" },
    ],
    response: [
      { name: "transactionId", type: "int" },
      { name: "idTagInfo", type: IdTagInfo },
    ],
  },
  {
    action: "StopTransaction",
    service: "Cs",
    request: [
      { name: "transactionId", type: "int" },
      { name: "idTag", type: "string", optional: true },
      { name: "timestamp", type: "dateTime" },
      { name: "meterStop", type: "int" },
    ],
    response: [{ name: "idTagInfo", type: IdTagInfo, optional: true }],
  },
  {
    action: "Heartbeat",
    service: "Cs",
    request: [],
    response: [{ name: "currentTime", type: "dateTime" }],
  },
  {
    action: "MeterValues",
    service: "Cs",
    request: [
      { name: "connectorId", type: "int" },
      { name: "values", type: MeterValue, optional: true, repeated: true },
    ],
    response: [],
  },
  {
    action: "BootNotification",
    service: "Cs",
    request: [
      { name: "chargePointVendor", type: "string" },
      { name: "chargePointModel", type: "string" },
      { name: "chargePointSerialNumber", type: "string", optional: true },
      { name: "chargeBoxSerialNumber", type: "string", optional: true },
      { name: "firmwareVersion", type: "string", optional: true },
      { name: "iccid", type: "string", optional: true },
      { name: "imsi", type: "string", optional: true },
      { name: "meterType", type: "string", optional: true },
      { name: "meterSerialNumber", type: "string", optional: true },
    ],
    response: [
      { name: "status", type: "string" },
      { name: "currentTime", type: "dateTime", optional: true },
      { name: "heartbeatInterval", type: "int", optional: true },
    ],
  },
  {
    action: "StatusNotification",
    service: "Cs",
    request: [
      { name: "connectorId", type: "int" },
      { name: "status", type: "string" },
      { name: "errorCode", type: "string" },
    ],
    response: [],
  },
  {
    action: "FirmwareStatusNotification",
    service: "Cs",
    request: [{ name: "status", type: "string" }],
    response: [],
  },
  {
    action: "DiagnosticsStatusNotification",
    service: "Cs",
    request: [{ name: "status", type: "string" }],
    response: [],
  },
];

const chargePointOperations: Operation[] = [
  {
    action: "UnlockConnector",
    service: "Cp",
    request: [{ name: "connectorId", type: "int" }],
    response: [{ name: "status", type: "string" }],
  },
  {
    action: "Reset",
    service: "Cp",
    request: [{ name: "type", type: "string" }],
    response: [{ name: "status", type: "string" }],
  },
  {
    action: "ChangeAvailability",
    service: "Cp",
    request: [
      { name: "connectorId", type: "int" },
      { name: "type", type: "string" },
    ],
    response: [{ name: "status", type: "string" }],
  },
  {
    action: "GetDiagnostics",
    service: "Cp",
    request: [
      { name: "location", type: "anyURI" },
      { name: "startTime", type: "dateTime", optional: true },
      { name: "stopTime", type: "dateTime", optional: true },
      { name: "retries", type: "int", optional: true },
      { name: "retryInterval", type: "int", optional: true },
    ],
    response: [{ name: "fileName", type: "string", optional: true }],
  },
  {
    action: "ClearCache",
    service: "Cp",
    request: [],
    response: [{ name: "status", type: "string" }],
  },
  {
    action: "UpdateFirmware",
    service: "Cp",
    request: [
      { name: "retrieveDate", type: "dateTime" },
      { name: "location", type: "anyURI" },
      { name: "retries", type: "int", optional: true },
      { name: "retryInterval", type: "int", optional: true },
    ],
    response: [],
  },
  {
    action: "ChangeConfiguration",
    service: "Cp",
    request: [
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    response: [{ name: "status", type: "string" }],
  },
  {
    action: "RemoteStartTransaction",
    service: "Cp",
    request: [
      { name: "idTag", type: "string" },
      { name: "connectorId", type: "int", optional: true, only: "2010_10" },
    ],
    response: [{ name: "status", type: "string" }],
  },
  {
    action: "RemoteStopTransaction",
    service: "Cp",
    request: [{ name: "transactionId", type: "int" }],
    response: [{ name: "status", type: "string" }],
  },
];

export const OCPP12_OPERATIONS: readonly Operation[] = [
  ...centralSystemOperations,
  ...chargePointOperations,
];

const lowerFirst = (value: string) =>
  value.charAt(0).toLowerCase() + value.slice(1);

export const requestElement = (action: string) =>
  `${lowerFirst(action)}Request`;

export const responseElement = (action: string) =>
  `${lowerFirst(action)}Response`;

export const findOperation = (action: string): Operation | undefined =>
  OCPP12_OPERATIONS.find((operation) => operation.action === action);
