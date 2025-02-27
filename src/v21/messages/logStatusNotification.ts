import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const LogStatusNotificationReqSchema = z.object({
  status: z.enum([
    "BadMessage",
    "Idle",
    "NotSupportedOperation",
    "PermissionDenied",
    "Uploaded",
    "UploadFailure",
    "Uploading",
    "AcceptedCanceled",
  ]),
  requestId: z.number().int().nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type LogStatusNotificationReqType = typeof LogStatusNotificationReqSchema;

const LogStatusNotificationResSchema = z.object({});
type LogStatusNotificationResType = typeof LogStatusNotificationResSchema;

class LogStatusNotificationOcppOutgoing extends OcppOutgoing<
  LogStatusNotificationReqType,
  LogStatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<LogStatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<LogStatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const logStatusNotificationOcppOutgoing =
  new LogStatusNotificationOcppOutgoing(
    "LogStatusNotification",
    LogStatusNotificationReqSchema,
    LogStatusNotificationResSchema,
  );
