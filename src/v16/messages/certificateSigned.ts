import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { logger } from "../../logger";

const CertificateSignedReqSchema = z.object({
  certificateChain: z.string(),
});
type CertificateSignedReqType = typeof CertificateSignedReqSchema;

const CertificateSignedResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
});
type CertificateSignedResType = typeof CertificateSignedResSchema;

class CertificateSignedOcppMessage extends OcppIncoming<
  CertificateSignedReqType,
  CertificateSignedResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<CertificateSignedReqType>>,
  ): Promise<void> => {
    logger.info(`[1.6] Received CertificateSigned`);

    if (call.payload.certificateChain && (vcp as any).pendingPrivateKey) {
      logger.info(
        "Successfully received signed certificate from CSMS. Storing for future mTLS connections...",
      );
      (vcp as any).vcpOptions.clientCert = call.payload.certificateChain;
      (vcp as any).vcpOptions.clientKey = (vcp as any).pendingPrivateKey;
      delete (vcp as any).pendingPrivateKey;

      vcp.respond(this.response(call, { status: "Accepted" }));
    } else {
      logger.warn(
        "Received CertificateSigned, but missing chain or pending private key.",
      );
      vcp.respond(this.response(call, { status: "Rejected" }));
    }
  };
}

export const certificateSignedOcppMessage = new CertificateSignedOcppMessage(
  "CertificateSigned",
  CertificateSignedReqSchema,
  CertificateSignedResSchema,
);
