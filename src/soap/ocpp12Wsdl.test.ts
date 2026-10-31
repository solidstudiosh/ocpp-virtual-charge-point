import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseXml, type XmlElement } from "./ocpp12Codec";
import {
  type Field,
  OCPP12_NAMESPACES,
  OCPP12_OPERATIONS,
  type Ocpp12Service,
  requestElement,
  responseElement,
} from "./ocpp12Schema";

// The OCPP 1.2 WSDLs are not redistributed here. Point OCPP12_WSDL_DIR at a
// directory with CentralSystemService-2010-08.wsdl, ChargePointService-2010-08.wsdl
// and their 2010-10 counterparts (e.g. the SOAP gateway's docs/ocpp12).
const WSDL_DIR = process.env.OCPP12_WSDL_DIR;
const XS = "http://www.w3.org/2001/XMLSchema";
const WSDL = "http://schemas.xmlsoap.org/wsdl/";

const SERVICE_FILE: Record<Ocpp12Service, string> = {
  Cs: "CentralSystemService",
  Cp: "ChargePointService",
};

interface WsdlField {
  name: string;
  type: string;
  min: string;
  max: string;
}

const children = (element: XmlElement, ns: string, name: string) =>
  element.children.filter((c) => c.ns === ns && c.name === name);

const loadSchema = (file: string) => {
  const definitions = parseXml(readFileSync(file, "utf8"));
  const schema = children(
    children(definitions, WSDL, "types")[0],
    XS,
    "schema",
  )[0];
  const complexTypes = new Map<string, WsdlField[]>();
  for (const type of children(schema, XS, "complexType")) {
    const sequence = children(type, XS, "sequence")[0];
    complexTypes.set(
      type.attributes.name,
      (sequence ? children(sequence, XS, "element") : []).map((e) => ({
        name: e.attributes.name,
        type: e.attributes.type,
        min: e.attributes.minOccurs ?? "1",
        max: e.attributes.maxOccurs ?? "1",
      })),
    );
  }
  const elements = new Map(
    children(schema, XS, "element").map((e) => [
      e.attributes.name,
      e.attributes.type.replace(/^tns:/, ""),
    ]),
  );
  const operations = children(
    children(definitions, WSDL, "portType")[0],
    WSDL,
    "operation",
  ).map((o) => o.attributes.name);
  return { complexTypes, elements, operations };
};

const SIMPLE_TYPES: Record<string, string> = {
  "s:int": "int",
  "s:string": "string",
  "s:dateTime": "dateTime",
  "s:anyURI": "anyURI",
};

const describeFields = (
  fields: Field[],
  namespace: string,
  complexTypes: Map<string, WsdlField[]>,
  // biome-ignore lint/suspicious/noExplicitAny: comparison shape
): any[] =>
  fields
    .filter((f) => !f.only || f.only === namespace)
    .map((f) => ({
      name: f.name,
      min: f.optional ? "0" : "1",
      max: f.repeated ? "unbounded" : "1",
      type:
        typeof f.type === "object"
          ? describeFields(f.type.fields, namespace, complexTypes)
          : f.type,
    }));

const describeWsdl = (
  fields: WsdlField[],
  complexTypes: Map<string, WsdlField[]>,
  // biome-ignore lint/suspicious/noExplicitAny: comparison shape
): any[] =>
  fields.map((f) => {
    const nested = complexTypes.get(f.type.replace(/^tns:/, ""));
    return {
      name: f.name,
      min: f.min,
      max: f.max,
      // Enumerations (tns:SomeStatus simple types) are strings on the wire.
      type: nested
        ? describeWsdl(nested, complexTypes)
        : (SIMPLE_TYPES[f.type] ?? "string"),
    };
  });

describe("OCPP 1.2 codec against the WSDLs", { skip: !WSDL_DIR }, () => {
  for (const namespace of OCPP12_NAMESPACES) {
    for (const service of ["Cs", "Cp"] as const) {
      const file = join(
        WSDL_DIR ?? "",
        `${SERVICE_FILE[service]}-${namespace.replace("_", "-")}.wsdl`,
      );
      it(`matches ${SERVICE_FILE[service]} ${namespace}`, () => {
        assert.ok(existsSync(file), `${file} missing`);
        const wsdl = loadSchema(file);
        const ours = OCPP12_OPERATIONS.filter((o) => o.service === service);
        assert.deepEqual(
          ours.map((o) => o.action).sort(),
          [...wsdl.operations].sort(),
        );
        for (const operation of ours) {
          for (const kind of ["request", "response"] as const) {
            const element =
              kind === "request"
                ? requestElement(operation.action)
                : responseElement(operation.action);
            const typeName = wsdl.elements.get(element);
            assert.ok(typeName, `${element} not in the WSDL`);
            assert.deepEqual(
              describeFields(operation[kind], namespace, wsdl.complexTypes),
              describeWsdl(
                wsdl.complexTypes.get(typeName) ?? [],
                wsdl.complexTypes,
              ),
              `${element} (${namespace})`,
            );
          }
        }
      });
    }
  }
});
