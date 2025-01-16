import { logger } from "./logger";
import { OcppVersion } from "./ocppVersion";
import { ocppMessages as ocppMessages16 } from "./v16/messageHandler";
import { ocppMessages as ocppMessages201 } from "./v201/messageHandler";

const SCHEMA_VALIDATION_ENABLED = true;

export const validateOcppRequest = (
  ocppVersion: OcppVersion,
  action: string,
  payload: any,
) => {
  if (!SCHEMA_VALIDATION_ENABLED) {
    return;
  }
  const ocppMessages =
    ocppVersion === OcppVersion.OCPP_1_6 ? ocppMessages16 : ocppMessages201;
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
  const ocppMessages =
    ocppVersion === OcppVersion.OCPP_1_6 ? ocppMessages16 : ocppMessages201;
  const ocppMessage = ocppMessages[action];
  if (!ocppMessage) {
    logger.warn(`Unknown action ${action}`);
    return;
  }
  ocppMessage.parseResponsePayload(payload);
};
