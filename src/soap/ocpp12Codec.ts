import { XMLParser } from "fast-xml-parser";
import {
  type ComplexType,
  FAULT_SUBCODE_NAMESPACE,
  type Field,
  type Ocpp12Namespace,
  type Ocpp12Service,
  OCPP12_NAMESPACES,
  OCPP12_OPERATIONS,
  type Operation,
  requestElement,
  responseElement,
  serviceNamespace,
} from "./ocpp12Schema";

export const SOAP12_NS = "http://www.w3.org/2003/05/soap-envelope";
export const WSA_NS = "http://www.w3.org/2005/08/addressing";
export const WSA_ANONYMOUS = `${WSA_NS}/anonymous`;
export const SOAP12_MEDIA_TYPE = "application/soap+xml";

export class Ocpp12CodecError extends Error {}

// biome-ignore lint/suspicious/noExplicitAny: decoded OCPP payloads are untyped
type Payload = Record<string, any>;

// ---------------------------------------------------------------- reading --

/** An XML element with its namespace resolved; children in document order. */
export interface XmlElement {
  ns: string;
  name: string;
  attributes: Record<string, string>;
  text: string;
  children: XmlElement[];
}

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

type OrderedNode = Record<string, unknown> & {
  ":@"?: Record<string, string>;
};

const toElement = (
  node: OrderedNode,
  parentScope: Record<string, string>,
): XmlElement | undefined => {
  const tag = Object.keys(node).find((key) => key !== ":@");
  if (!tag || tag === "#text" || tag.startsWith("?") || tag === "#comment") {
    return undefined;
  }
  const attributes = node[":@"] ?? {};
  const scope = { ...parentScope };
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "xmlns") {
      scope[""] = value;
    } else if (key.startsWith("xmlns:")) {
      scope[key.slice("xmlns:".length)] = value;
    }
  }
  const separator = tag.indexOf(":");
  const prefix = separator === -1 ? "" : tag.slice(0, separator);
  const name = separator === -1 ? tag : tag.slice(separator + 1);
  const ns = scope[prefix];
  if (ns === undefined && prefix !== "") {
    throw new Ocpp12CodecError(`Undeclared namespace prefix in <${tag}>`);
  }
  const content = (node[tag] ?? []) as OrderedNode[];
  const children: XmlElement[] = [];
  let text = "";
  for (const child of content) {
    if ("#text" in child) {
      text += String(child["#text"]);
      continue;
    }
    const element = toElement(child, scope);
    if (element) {
      children.push(element);
    }
  }
  return { ns: ns ?? "", name, attributes, text, children };
};

export const parseXml = (xml: string): XmlElement => {
  let nodes: OrderedNode[];
  try {
    nodes = parser.parse(xml) as OrderedNode[];
  } catch (error) {
    throw new Ocpp12CodecError(`Malformed XML: ${String(error)}`);
  }
  for (const node of nodes) {
    const element = toElement(node, {});
    if (element) {
      return element;
    }
  }
  throw new Ocpp12CodecError("No root element");
};

const child = (
  element: XmlElement | undefined,
  ns: string,
  name: string,
): XmlElement | undefined =>
  element?.children.find((c) => c.ns === ns && c.name === name);

const withoutPrefix = (qname: string) => qname.slice(qname.indexOf(":") + 1);

export interface SoapHeaders {
  chargeBoxIdentity?: string;
  action?: string;
  messageId?: string;
  relatesTo?: string;
  from?: string;
  replyTo?: string;
  to?: string;
}

export interface SoapFault {
  code: string;
  subcode?: string;
  reason: string;
}

export interface DecodedMessage {
  operation: Operation;
  kind: "request" | "response";
  namespace: Ocpp12Namespace;
  payload: Payload;
}

export interface SoapEnvelope {
  headers: SoapHeaders;
  body?: XmlElement;
  fault?: SoapFault;
}

export const parseEnvelope = (xml: string): SoapEnvelope => {
  const envelope = parseXml(xml);
  if (envelope.ns !== SOAP12_NS || envelope.name !== "Envelope") {
    throw new Ocpp12CodecError(
      `Not a SOAP 1.2 envelope: {${envelope.ns}}${envelope.name}`,
    );
  }
  const header = child(envelope, SOAP12_NS, "Header");
  const text = (name: string) => child(header, WSA_NS, name)?.text;
  const address = (name: string) =>
    child(child(header, WSA_NS, name), WSA_NS, "Address")?.text;
  const headers: SoapHeaders = {
    chargeBoxIdentity: header?.children.find(
      (c) => c.name === "chargeBoxIdentity" && c.ns.startsWith("urn://Ocpp/"),
    )?.text,
    action: text("Action"),
    messageId: text("MessageID"),
    relatesTo: text("RelatesTo"),
    from: address("From"),
    replyTo: address("ReplyTo"),
    to: text("To"),
  };
  const body = child(envelope, SOAP12_NS, "Body")?.children[0];
  if (!body) {
    throw new Ocpp12CodecError("Empty SOAP Body");
  }
  if (body.ns === SOAP12_NS && body.name === "Fault") {
    const code = child(body, SOAP12_NS, "Code");
    const subcode = child(
      child(code, SOAP12_NS, "Subcode"),
      SOAP12_NS,
      "Value",
    );
    return {
      headers,
      fault: {
        code: withoutPrefix(child(code, SOAP12_NS, "Value")?.text ?? ""),
        subcode: subcode ? withoutPrefix(subcode.text) : undefined,
        reason:
          child(child(body, SOAP12_NS, "Reason"), SOAP12_NS, "Text")?.text ??
          "",
      },
    };
  }
  return { headers, body };
};

const namespaceOf = (
  ns: string,
): { service: Ocpp12Service; namespace: Ocpp12Namespace } | undefined => {
  for (const namespace of OCPP12_NAMESPACES) {
    for (const service of ["Cs", "Cp"] as const) {
      if (serviceNamespace(service, namespace) === ns) {
        return { service, namespace };
      }
    }
  }
  return undefined;
};

const MIN_INT = -(2 ** 31);
const MAX_INT = 2 ** 31 - 1;

const readFields = (
  element: XmlElement,
  fields: Field[],
  namespace: Ocpp12Namespace,
  path: string,
): Payload => {
  const payload: Payload = {};
  for (const node of element.children) {
    const where = `${path}/${node.name}`;
    const field = fields.find((f) => f.name === node.name);
    if (!field || (field.only && field.only !== namespace)) {
      throw new Ocpp12CodecError(`Unexpected element ${where}`);
    }
    if (node.ns !== element.ns) {
      throw new Ocpp12CodecError(`${where} is in namespace ${node.ns}`);
    }
    const value = readValue(node, field, namespace, where);
    if (field.repeated) {
      payload[field.name] = [...(payload[field.name] ?? []), value];
    } else if (field.name in payload) {
      throw new Ocpp12CodecError(`Repeated element ${where}`);
    } else {
      payload[field.name] = value;
    }
  }
  for (const field of fields) {
    const applies = !field.only || field.only === namespace;
    if (applies && !field.optional && !(field.name in payload)) {
      throw new Ocpp12CodecError(`Missing element ${path}/${field.name}`);
    }
  }
  return payload;
};

const readValue = (
  node: XmlElement,
  field: Field,
  namespace: Ocpp12Namespace,
  where: string,
  // biome-ignore lint/suspicious/noExplicitAny: decoded OCPP value
): any => {
  if (typeof field.type === "object") {
    return readFields(node, field.type.fields, namespace, where);
  }
  if (node.children.length > 0) {
    throw new Ocpp12CodecError(`${where} must be a simple value`);
  }
  if (field.type === "int") {
    if (!/^[+-]?\d+$/.test(node.text)) {
      throw new Ocpp12CodecError(`${where} is not an int: '${node.text}'`);
    }
    const value = Number(node.text);
    if (value < MIN_INT || value > MAX_INT) {
      throw new Ocpp12CodecError(`${where} is out of the int range`);
    }
    return value;
  }
  return node.text;
};

/** The OCPP message in a SOAP Body element, version detected from its namespace. */
export const decodeBody = (body: XmlElement): DecodedMessage => {
  const resolved = namespaceOf(body.ns);
  if (!resolved) {
    throw new Ocpp12CodecError(
      `Unknown OCPP namespace '${body.ns}' of <${body.name}>`,
    );
  }
  for (const operation of OCPP12_OPERATIONS) {
    if (operation.service !== resolved.service) {
      continue;
    }
    const kind =
      requestElement(operation.action) === body.name
        ? "request"
        : responseElement(operation.action) === body.name
          ? "response"
          : undefined;
    if (kind) {
      return {
        operation,
        kind,
        namespace: resolved.namespace,
        payload: readFields(
          body,
          operation[kind],
          resolved.namespace,
          body.name,
        ),
      };
    }
  }
  throw new Ocpp12CodecError(`Unknown OCPP 1.2 element <${body.name}>`);
};

// ---------------------------------------------------------------- writing --

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const writeValue = (
  field: Field,
  // biome-ignore lint/suspicious/noExplicitAny: OCPP value
  value: any,
  namespace: Ocpp12Namespace,
  where: string,
): string => {
  if (typeof field.type === "object") {
    return writeFields(field.type, value, namespace, where);
  }
  if (field.type === "int") {
    if (!Number.isInteger(value) || value < MIN_INT || value > MAX_INT) {
      throw new Ocpp12CodecError(`${where} is not an int: ${value}`);
    }
    return String(value);
  }
  if (typeof value !== "string") {
    throw new Ocpp12CodecError(`${where} is not a string: ${value}`);
  }
  return escapeXml(value);
};

const writeFields = (
  type: Pick<ComplexType, "fields">,
  payload: Payload,
  namespace: Ocpp12Namespace,
  path: string,
): string => {
  if (payload === null || typeof payload !== "object") {
    throw new Ocpp12CodecError(`${path} is not an object`);
  }
  const known = new Set(type.fields.map((f) => f.name));
  const unknown = Object.keys(payload).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new Ocpp12CodecError(`${path} has unknown fields: ${unknown}`);
  }
  let xml = "";
  for (const field of type.fields) {
    const where = `${path}/${field.name}`;
    const value = payload[field.name];
    if (field.only && field.only !== namespace) {
      continue;
    }
    if (value === undefined || value === null) {
      if (!field.optional) {
        throw new Ocpp12CodecError(`Missing ${where}`);
      }
      continue;
    }
    const values = field.repeated ? value : [value];
    if (!Array.isArray(values)) {
      throw new Ocpp12CodecError(`${where} is not an array`);
    }
    for (const item of values) {
      xml += `<${field.name}>${writeValue(field, item, namespace, where)}</${field.name}>`;
    }
  }
  return xml;
};

/** The SOAP Body element of an OCPP message, fields in WSDL order. */
export const encodeBody = (
  operation: Operation,
  kind: "request" | "response",
  payload: Payload,
  namespace: Ocpp12Namespace,
): string => {
  const element =
    kind === "request"
      ? requestElement(operation.action)
      : responseElement(operation.action);
  const ns = serviceNamespace(operation.service, namespace);
  const fields = writeFields(
    { fields: operation[kind] },
    payload ?? {},
    namespace,
    element,
  );
  return `<${element} xmlns="${ns}">${fields}</${element}>`;
};

const envelope = (header: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="${SOAP12_NS}" xmlns:wsa="${WSA_NS}"><s:Header>${header}</s:Header><s:Body>${body}</s:Body></s:Envelope>`;

const wsa = (name: string, value: string) =>
  `<wsa:${name}>${escapeXml(value)}</wsa:${name}>`;

const wsaAddress = (name: string, value: string) =>
  `<wsa:${name}>${wsa("Address", value)}</wsa:${name}>`;

export interface RequestEnvelope {
  operation: Operation;
  namespace: Ocpp12Namespace;
  payload: Payload;
  chargeBoxIdentity: string;
  messageId: string;
  from?: string;
  to: string;
}

/** A request with chargeBoxIdentity and WS-Addressing headers (spec §8.1, §8.3). */
export const encodeRequestEnvelope = (request: RequestEnvelope): string => {
  const ns = serviceNamespace(request.operation.service, request.namespace);
  const header = [
    `<chargeBoxIdentity xmlns="${ns}">${escapeXml(request.chargeBoxIdentity)}</chargeBoxIdentity>`,
    wsa("Action", `/${request.operation.action}`),
    wsa("MessageID", request.messageId),
    request.from ? wsaAddress("From", request.from) : "",
    wsaAddress("ReplyTo", WSA_ANONYMOUS),
    wsa("To", request.to),
  ].join("");
  return envelope(
    header,
    encodeBody(
      request.operation,
      "request",
      request.payload,
      request.namespace,
    ),
  );
};

const responseHeader = (
  action: string,
  messageId: string,
  relatesTo?: string,
) =>
  wsa("Action", action) +
  (relatesTo ? wsa("RelatesTo", relatesTo) : "") +
  wsa("MessageID", messageId);

export const encodeResponseEnvelope = (response: {
  operation: Operation;
  namespace: Ocpp12Namespace;
  payload: Payload;
  messageId: string;
  relatesTo?: string;
}): string =>
  envelope(
    responseHeader(
      `/${response.operation.action}Response`,
      response.messageId,
      response.relatesTo,
    ),
    encodeBody(
      response.operation,
      "response",
      response.payload,
      response.namespace,
    ),
  );

export const encodeFaultEnvelope = (fault: {
  code: "Sender" | "Receiver";
  subcode: string;
  reason: string;
  messageId: string;
  relatesTo?: string;
}): string =>
  envelope(
    responseHeader(`${WSA_NS}/soap/fault`, fault.messageId, fault.relatesTo),
    `<s:Fault><s:Code><s:Value>s:${fault.code}</s:Value><s:Subcode><s:Value xmlns:ocpp="${FAULT_SUBCODE_NAMESPACE}">ocpp:${escapeXml(fault.subcode)}</s:Value></s:Subcode></s:Code><s:Reason><s:Text xml:lang="en">${escapeXml(fault.reason)}</s:Text></s:Reason></s:Fault>`,
  );
