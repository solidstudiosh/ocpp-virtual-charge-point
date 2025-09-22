import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  CertificateHashDataTypeSchema,
  GenericStatusEnumSchema,
  StatusInfoTypeSchema,
} from "./_common";

const SignCertificateReqSchema = z.object({
  csr: z.string().max(5500),
  certificateType: z
    .enum(["ChargingStationCertificate", "V2GCertificate", "V2G20Certificate"])
    .nullish(),
  requestId: z.number().int().nullish(),
  hashRootCertificate: CertificateHashDataTypeSchema.nullish(),
});
type SignCertificateReqType = typeof SignCertificateReqSchema;

const SignCertificateResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SignCertificateResType = typeof SignCertificateResSchema;

class SignCertificateOcppOutgoing extends OcppOutgoing<
  SignCertificateReqType,
  SignCertificateResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<SignCertificateReqType>>,
    _result: OcppCallResult<z.infer<SignCertificateResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const signCertificateOcppOutgoing = new SignCertificateOcppOutgoing(
  "SignCertificate",
  SignCertificateReqSchema,
  SignCertificateResSchema,
);
