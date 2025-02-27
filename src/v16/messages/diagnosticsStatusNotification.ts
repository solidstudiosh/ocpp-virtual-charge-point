import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const DiagnosticsStatusNotificationReqSchema = z.object({
  status: z.enum(["Idle", "Uploaded", "UploadFailed", "Uploading"]),
});
type DiagnosticsStatusNotificationReqType =
  typeof DiagnosticsStatusNotificationReqSchema;

const DiagnosticsStatusNotificationResSchema = z.object({});
type DiagnosticsStatusNotificationResType =
  typeof DiagnosticsStatusNotificationResSchema;

class DiagnosticsStatusNotificationOcppMessage extends OcppOutgoing<
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
