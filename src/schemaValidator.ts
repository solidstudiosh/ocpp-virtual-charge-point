import { logger } from "./logger";
import { OcppVersion } from "./ocppVersion";
import {
  ocppIncomingMessages as ocppIncomingMessages16,
  ocppOutgoingMessages as ocppOutgoingMessages16,
} from "./v16/messageHandler";
import { ocppMessages as ocppMessages21 } from "./v21/messageHandler";
import {
  ocppIncomingMessages as ocppIncomingMessages201,
  ocppOutgoingMessages as ocppOutgoingMessages201,
} from "./v201/messageHandler";

const SCHEMA_VALIDATION_ENABLED = true;

const getOcppIncomingMessages = (ocppVersion: OcppVersion) => {
  switch (ocppVersion) {
    case OcppVersion.OCPP_1_6:
      return ocppIncomingMessages16;
    case OcppVersion.OCPP_2_0_1:
      return ocppIncomingMessages201;
    case OcppVersion.OCPP_2_1:
      return ocppMessages21;
    default:
      throw new Error(`Ocpp messages not found for version: ${ocppVersion}`);
  }
};

const getOcppOutgoingMessages = (ocppVersion: OcppVersion) => {
  switch (ocppVersion) {
    case OcppVersion.OCPP_1_6:
      return ocppOutgoingMessages16;
    case OcppVersion.OCPP_2_0_1:
      return ocppOutgoingMessages201;
    case OcppVersion.OCPP_2_1:
      return ocppMessages21;
    default:
      throw new Error(`Ocpp messages not found for version: ${ocppVersion}`);
  }
};

export const validateOcppRequest = (
  ocppVersion: OcppVersion,
  action: string,
  // biome-ignore lint/suspicious/noExplicitAny: ocpp message
  payload: any,
) => {
  if (!SCHEMA_VALIDATION_ENABLED) {
    return;
  }
  const ocppMessages = getOcppIncomingMessages(ocppVersion);
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
  // biome-ignore lint/suspicious/noExplicitAny: ocpp message
  payload: any,
) => {
  if (!SCHEMA_VALIDATION_ENABLED) {
    return;
  }
  const ocppMessages = getOcppOutgoingMessages(ocppVersion);
  const ocppMessage = ocppMessages[action];
  if (!ocppMessage) {
    logger.warn(`Unknown action ${action}`);
    return;
  }
  ocppMessage.parseResponsePayload(payload);
};
