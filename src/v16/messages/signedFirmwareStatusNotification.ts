import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const SignedFirmwareStatusNotificationReqSchema = z.object({
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
type SignedFirmwareStatusNotificationReqType =
  typeof SignedFirmwareStatusNotificationReqSchema;

const SignedFirmwareStatusNotificationResSchema = z.object({});
type SignedFirmwareStatusNotificationResType =
  typeof SignedFirmwareStatusNotificationResSchema;

class SignedFirmwareStatusNotificationOcppMessage extends OcppMessage<
  SignedFirmwareStatusNotificationReqType,
  SignedFirmwareStatusNotificationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<SignedFirmwareStatusNotificationReqType>>,
    _result: OcppCallResult<z.infer<SignedFirmwareStatusNotificationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const signedFirmwareStatusNotificationOcppMessage =
  new SignedFirmwareStatusNotificationOcppMessage(
    "SignedFirmwareStatusNotification",
    SignedFirmwareStatusNotificationReqSchema,
    SignedFirmwareStatusNotificationResSchema,
  );
