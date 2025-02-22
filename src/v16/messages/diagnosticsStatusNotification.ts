import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const DiagnosticsStatusNotificationReqSchema = z.object({
  status: z.enum(["Idle", "Uploaded", "UploadFailed", "Uploading"]),
});
type DiagnosticsStatusNotificationReqType =
  typeof DiagnosticsStatusNotificationReqSchema;

const DiagnosticsStatusNotificationResSchema = z.object({});
type DiagnosticsStatusNotificationResType =
  typeof DiagnosticsStatusNotificationResSchema;

class DiagnosticsStatusNotificationOcppMessage extends OcppMessage<
  DiagnosticsStatusNotificationReqType,
  DiagnosticsStatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<DiagnosticsStatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<DiagnosticsStatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const diagnosticsStatusNotificationOcppMessage =
  new DiagnosticsStatusNotificationOcppMessage(
    "DiagnosticsStatusNotification",
    DiagnosticsStatusNotificationReqSchema,
    DiagnosticsStatusNotificationResSchema,
  );
