import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  EnergyTransferMode,
  IdTokenInfoTypeSchema,
  IdTokenTypeSchema,
  OCSPRequestDataTypeSchema,
  Tariff,
} from "./_common";

const AuthorizeReqSchema = z.object({
  certificate: z.string().max(10000).nullish(),
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
  allowedEnergyTransfer: z.array(EnergyTransferMode).nullish(),
  idTokenInfo: IdTokenInfoTypeSchema,
  tariff: Tariff.nullish(),
});
type AuthorizeResType = typeof AuthorizeResSchema;

class AuthorizeOcppOutgoing extends OcppOutgoing<
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

export const authorizeOcppOutgoing = new AuthorizeOcppOutgoing(
  "Authorize",
  AuthorizeReqSchema,
  AuthorizeResSchema,
);
