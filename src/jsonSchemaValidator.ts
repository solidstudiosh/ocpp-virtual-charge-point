import Ajv from "ajv";
import { logger } from "./logger";
import { OcppVersion } from "./ocppVersion";

const ajv = new Ajv({ multipleOfPrecision: 1 });

const JSON_SCHEMA_VALIDATION_ENABLED = true;
const JSON_SCHEMA_BASE_DIR = "../_json_schema";

const jsonSchemaDir = (ocppVersion: OcppVersion) => {
  if (ocppVersion === OcppVersion.OCPP_1_6) {
    return `${JSON_SCHEMA_BASE_DIR}/v16`;
  } else if (ocppVersion === OcppVersion.OCPP_2_0_1) {
    return `${JSON_SCHEMA_BASE_DIR}/v201`;
  }
};

export const validateOcppRequest = (
  ocppVersion: OcppVersion,
  action: string,
  payload: any
) => {
  if (!JSON_SCHEMA_VALIDATION_ENABLED) {
    return;
  }
  const schemaDir = jsonSchemaDir(ocppVersion);
  const schema = require(`${schemaDir}/${action}.json`);
  const validate = ajv.compile(schema);
  const valid = validate(payload);
  if (!valid) {
    logger.warn(JSON.stringify(validate.errors));
  } else {
    logger.debug(`Schema for ${action} OK`);
  }
};

export const validateOcppResponse = (
  ocppVersion: OcppVersion,
  action: string,
  payload: any
) => {
  if (!JSON_SCHEMA_VALIDATION_ENABLED) {
    return;
  }
  const schemaDir = jsonSchemaDir(ocppVersion);
  const schema = require(`${schemaDir}/${action}Response.json`);
  const validate = ajv.compile(schema);
  const valid = validate(payload);
  if (!valid) {
    logger.warn(JSON.stringify(validate.errors));
  } else {
    logger.debug(`Schema for ${action} Response OK`);
  }
};
