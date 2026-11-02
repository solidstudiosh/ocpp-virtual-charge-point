import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ChargePointStatusSchema, ConnectorIdSchema } from "./_common";

// 1.2 has no Charging/Preparing/Finishing: a connector in use is Occupied and
// the central system derives finer states from the transaction.
const StatusNotificationReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  status: ChargePointStatusSchema,
  errorCode: z.enum([
    "ConnectorLockFailure",
    "HighTemperature",
    "Mode3Error",
    "NoError",
    "PowerMeterFailure",
    "PowerSwitchFailure",
    "ReaderFailure",
    "ResetFailure",
  ]),
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
