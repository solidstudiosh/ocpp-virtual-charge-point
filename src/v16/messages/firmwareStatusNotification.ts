import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const FirmwareStatusNotificationReqSchema = z.object({
  status: z.enum([
    "Downloaded",
    "DownloadFailed",
    "Downloading",
    "Idle",
    "InstallationFailed",
    "Installing",
    "Installed",
  ]),
});
type FirmwareStatusNotificationReqType =
  typeof FirmwareStatusNotificationReqSchema;

const FirmwareStatusNotificationResSchema = z.object({});
type FirmwareStatusNotificationResType =
  typeof FirmwareStatusNotificationResSchema;

class FirmwareStatusNotificationOcppMessage extends OcppOutgoing<
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
