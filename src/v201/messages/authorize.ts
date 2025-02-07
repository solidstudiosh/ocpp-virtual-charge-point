import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import {
  IdTokenInfoTypeSchema,
  IdTokenTypeSchema,
  OCSPRequestDataTypeSchema,
} from "./_common";

const AuthorizeReqSchema = z.object({
  certificate: z.string().max(5500).nullish(),
  idToken: IdTokenTypeSchema,
  iso15118CertificateHashData: z
    .array(OCSPRequestDataTypeSchema)
    .max(4)
    .nullish(),
});
type AuthorizeReqType = typeof AuthorizeReqSchema;

const AuthorizeResSchema = z.object({
  certificateStatus: z
    .enum([
      "Accepted",
      "SignatureError",
      "CertificateExpired",
      "CertificateRevoked",
      "NoCertificateAvailable",
      "CertChainError",
      "ContractCancelled",
    ])
    .nullish(),
  idTokenInfo: IdTokenInfoTypeSchema,
});
type AuthorizeResType = typeof AuthorizeResSchema;

class AuthorizeOcppMessage extends OcppMessage<
  AuthorizeReqType,
  AuthorizeResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<AuthorizeReqType>>,
    _result: OcppCallResult<z.infer<AuthorizeResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const authorizeOcppMessage = new AuthorizeOcppMessage(
  "Authorize",
  AuthorizeReqSchema,
  AuthorizeResSchema,
);
