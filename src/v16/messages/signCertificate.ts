import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { logger } from "../../logger";

const SignCertificateReqSchema = z.object({
  csr: z.string(),
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
    result: OcppCallResult<z.infer<SignCertificateResType>>,
  ): Promise<void> => {
    logger.info(
      `[1.6] SignCertificate Response Received: ${JSON.stringify(result[2])}`,
    );
  };
}

export const signCertificateOcppMessage = new SignCertificateOcppMessage(
  "SignCertificate",
  SignCertificateReqSchema,
  SignCertificateResSchema,
);
