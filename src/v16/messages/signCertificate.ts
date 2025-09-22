import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const SignCertificateReqSchema = z.object({
  csr: z.string().max(5500),
});
type SignCertificateReqType = typeof SignCertificateReqSchema;

const SignCertificateResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type SignCertificateResType = typeof SignCertificateResSchema;

class SignCertificateOcppMessage extends OcppOutgoing<
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

export const signCertificateOcppMessage = new SignCertificateOcppMessage(
  "SignCertificate",
  SignCertificateReqSchema,
  SignCertificateResSchema,
);
