import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const FirmwareStatusNotificationReqSchema = z.object({
  status: z.enum([
    "Downloaded",
    "DownloadFailed",
    "Downloading",
    "DownloadScheduled",
    "DownloadPaused",
    "Idle",
    "InstallationFailed",
    "Installing",
    "Installed",
    "InstallRebooting",
    "InstallScheduled",
    "InstallVerificationFailed",
    "InvalidSignature",
    "SignatureVerified",
  ]),
  requestId: z.number().int().nullish(),
});
type FirmwareStatusNotificationReqType =
  typeof FirmwareStatusNotificationReqSchema;

const FirmwareStatusNotificationResSchema = z.object({});
type FirmwareStatusNotificationResType =
  typeof FirmwareStatusNotificationResSchema;

class FirmwareStatusNotificationOcppMessage extends OcppMessage<
  FirmwareStatusNotificationReqType,
  FirmwareStatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<FirmwareStatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<FirmwareStatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const firmwareStatusNotificationOcppMessage =
  new FirmwareStatusNotificationOcppMessage(
    "FirmwareStatusNotification",
    FirmwareStatusNotificationReqSchema,
    FirmwareStatusNotificationResSchema,
  );
