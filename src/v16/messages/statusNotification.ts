import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema } from "./_common";

const StatusNotificationReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  errorCode: z.enum([
    "ConnectorLockFailure",
    "EVCommunicationError",
    "GroundFailure",
    "HighTemperature",
    "InternalError",
    "LocalListConflict",
    "NoError",
    "OtherError",
    "OverCurrentFailure",
    "OverVoltage",
    "PowerMeterFailure",
    "PowerSwitchFailure",
    "ReaderFailure",
    "ResetFailure",
    "UnderVoltage",
    "WeakSignal",
  ]),
  info: z.string().max(50).nullish(),
  status: z.enum([
    "Available",
    "Preparing",
    "Charging",
    "SuspendedEVSE",
    "SuspendedEV",
    "Finishing",
    "Reserved",
    "Unavailable",
    "Faulted",
  ]),
  timestamp: z.string().datetime().nullish(),
  vendorId: z.string().max(255).nullish(),
  vendorErrorCode: z.string().max(50).nullish(),
});
type StatusNotificationReqType = typeof StatusNotificationReqSchema;

const StatusNotificationResSchema = z.object({});
type StatusNotificationResType = typeof StatusNotificationResSchema;

class StatusNotificationOcppMessage extends OcppOutgoing<
  StatusNotificationReqType,
  StatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<StatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<StatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const statusNotificationOcppMessage = new StatusNotificationOcppMessage(
  "StatusNotification",
  StatusNotificationReqSchema,
  StatusNotificationResSchema,
);
