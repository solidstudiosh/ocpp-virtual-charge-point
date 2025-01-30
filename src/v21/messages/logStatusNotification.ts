import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class LogStatusNotificationOcppMessage extends OcppMessage<
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

export const logStatusNotificationOcppMessage =
  new LogStatusNotificationOcppMessage(
    "LogStatusNotification",
    LogStatusNotificationReqSchema,
    LogStatusNotificationResSchema,
  );
