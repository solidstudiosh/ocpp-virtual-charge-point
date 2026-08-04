import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import { resolveTokenPlaceholder } from "../../tokenPlaceholder";
import type { VCP } from "../../vcp";
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

class AuthorizeOcppOutgoing extends OcppOutgoing<
  AuthorizeReqType,
  AuthorizeResType
> {
  beforeSend = (
    _vcp: VCP,
    payload: z.infer<AuthorizeReqType>,
  ): z.infer<AuthorizeReqType> => {
    return {
      ...payload,
      idToken: {
        ...payload.idToken,
        idToken: resolveTokenPlaceholder(payload.idToken.idToken),
      },
    };
  };

  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<AuthorizeReqType>>,
    _result: OcppCallResult<z.infer<AuthorizeResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const authorizeOcppOutgoing = new AuthorizeOcppOutgoing(
  "Authorize",
  AuthorizeReqSchema,
  AuthorizeResSchema,
);
