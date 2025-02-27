import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppIncoming,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const SignedUpdateFirmwareReqSchema = z.object({
  retries: z.number().int().nullish(),
  retryInterval: z.number().int().nullish(),
  requestId: z.number().int(),
  firmware: z.object({
    location: z.string().url(),
    retrieveDateTime: z.string().datetime(),
    installDateTime: z.string().datetime().nullish(),
    signingCertificate: z.string(),
    signature: z.string(),
  }),
});
type SignedUpdateFirmwareReqType = typeof SignedUpdateFirmwareReqSchema;

const SignedUpdateFirmwareResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "AcceptedCanceled"]),
  statusInfo: z
    .object({
      reasonCode: z.string().max(20),
      additionalInfo: z.string().max(512).nullish(),
    })
    .nullish(),
});
type SignedUpdateFirmwareResType = typeof SignedUpdateFirmwareResSchema;

class SignedUpdateFirmwareIncomingOcppMessage extends OcppIncoming<
  SignedUpdateFirmwareReqType,
  SignedUpdateFirmwareResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SignedUpdateFirmwareReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

class SignedUpdateFirmwareOutgoingOcppMessage extends OcppOutgoing<
  SignedUpdateFirmwareReqType,
  SignedUpdateFirmwareResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<SignedUpdateFirmwareReqType>>,
    _result: OcppCallResult<z.infer<SignedUpdateFirmwareResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const signedUpdateFirmwareIncomingOcppMessage =
  new SignedUpdateFirmwareIncomingOcppMessage(
    "SignedUpdateFirmware",
    SignedUpdateFirmwareReqSchema,
    SignedUpdateFirmwareResSchema,
  );

export const signedUpdateFirmwareOutgoingOcppMessage =
  new SignedUpdateFirmwareOutgoingOcppMessage(
    "SignedUpdateFirmware",
    SignedUpdateFirmwareReqSchema,
    SignedUpdateFirmwareResSchema,
  );
