import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppMessage,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const PublishFirmwareStatusNotificationReqSchema = z.object({
  status: z.enum([
    "Idle",
    "DownloadScheduled",
    "Downloading",
    "Downloaded",
    "Published",
    "DownloadFailed",
    "DownloadPaused",
    "InvalidChecksum",
    "ChecksumVerified",
    "PublishFailed",
  ]),
  location: z.array(z.string().url().max(2000)).nullish(),
  requestId: z.number().int().nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type PublishFirmwareStatusNotificationReqType =
  typeof PublishFirmwareStatusNotificationReqSchema;

const PublishFirmwareStatusNotificationResSchema = z.object({});
type PublishFirmwareStatusNotificationResType =
  typeof PublishFirmwareStatusNotificationResSchema;

class PublishFirmwareStatusNotificationOcppMessage extends OcppMessage<
  PublishFirmwareStatusNotificationReqType,
  PublishFirmwareStatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<PublishFirmwareStatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<PublishFirmwareStatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const publishFirmwareStatusNotificationOcppMessage =
  new PublishFirmwareStatusNotificationOcppMessage(
    "PublishFirmwareStatusNotification",
    PublishFirmwareStatusNotificationReqSchema,
    PublishFirmwareStatusNotificationResSchema,
  );
