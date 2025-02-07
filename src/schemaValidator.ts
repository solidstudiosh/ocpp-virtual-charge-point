import { logger } from "./logger";
import { OcppVersion } from "./ocppVersion";
import { ocppMessages as ocppMessages16 } from "./v16/messageHandler";
import { ocppMessages as ocppMessages201 } from "./v201/messageHandler";
import { ocppMessages as ocppMessages21 } from "./v21/messageHandler";

const SCHEMA_VALIDATION_ENABLED = true;

const getOcppMessages = (ocppVersion: OcppVersion) => {
  switch (ocppVersion) {
    case OcppVersion.OCPP_1_6:
      return ocppMessages16;
    case OcppVersion.OCPP_2_0_1:
      return ocppMessages201;
    case OcppVersion.OCPP_2_1:
      return ocppMessages21;
    default:
      throw new Error(`Ocpp messages not found for version: ${ocppVersion}`);
  }
};

export const validateOcppRequest = (
  ocppVersion: OcppVersion,
  action: string,
  payload: any,
) => {
  if (!SCHEMA_VALIDATION_ENABLED) {
    return;
  }
  const ocppMessages = getOcppMessages(ocppVersion);
  const ocppMessage = ocppMessages[action];
  if (!ocppMessage) {
    logger.warn(`Unknown action ${action}`);
    return;
  }
  ocppMessage.parseRequestPayload(payload);
};

export const validateOcppResponse = (
  ocppVersion: OcppVersion,
  action: string,
  payload: any,
) => {
  if (!SCHEMA_VALIDATION_ENABLED) {
    return;
  }
  const ocppMessages = getOcppMessages(ocppVersion);
  const ocppMessage = ocppMessages[action];
  if (!ocppMessage) {
    logger.warn(`Unknown action ${action}`);
    return;
  }
  ocppMessage.parseResponsePayload(payload);
};
