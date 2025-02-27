import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { CertificateHashDataTypeSchema, StatusInfoTypeSchema } from "./_common";

const GetCertificateChainStatusReqSchema = z.object({
  certificateStatusRequests: z.array(
    z.object({
      source: z.enum(["CRL", "OCSP"]),
      urls: z.array(z.string().max(2000)).max(5),
      certificateHashData: CertificateHashDataTypeSchema,
    }),
  ),
});
type GetCertificateChainStatusReqType =
  typeof GetCertificateChainStatusReqSchema;

const GetCertificateChainStatusResSchema = z.object({
  certificateStatus: z
    .array(
      z.object({
        source: z.enum(["CRL", "OCSP"]),
        status: z.enum(["Good", "Revoked", "Unknown", "Failed"]),
        nextUpdate: z.string().datetime(),
        certificateHashData: CertificateHashDataTypeSchema,
      }),
    )
    .max(4),
});
type GetCertificateChainStatusResType =
  typeof GetCertificateChainStatusResSchema;

class GetCertificateChainStatusOcppOutgoing extends OcppOutgoing<
  GetCertificateChainStatusReqType,
  GetCertificateChainStatusResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<GetCertificateChainStatusReqType>>,
    _result: OcppCallResult<z.infer<GetCertificateChainStatusResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const getCertificateChainStatusOcppOutgoing =
  new GetCertificateChainStatusOcppOutgoing(
    "GetCertificateChainStatus",
    GetCertificateChainStatusReqSchema,
    GetCertificateChainStatusResSchema,
  );
