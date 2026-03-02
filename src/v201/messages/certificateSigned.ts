import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";
import { logger } from "../../logger";

const CertificateSignedReqSchema = z.object({
  certificateChain: z.string().max(10000),
  certificateType: z
    .enum(["ChargeStationCertificate", "V2GCertificate"])
    .nullish(),
});
type CertificateSignedReqType = typeof CertificateSignedReqSchema;

const CertificateSignedResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type CertificateSignedResType = typeof CertificateSignedResSchema;

class CertificateSignedOcppIncoming extends OcppIncoming<
  CertificateSignedReqType,
  CertificateSignedResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<CertificateSignedReqType>>,
  ): Promise<void> => {
    logger.info(`[2.0.1] Received CertificateSigned`);

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

export const certificateSignedOcppIncoming = new CertificateSignedOcppIncoming(
  "CertificateSigned",
  CertificateSignedReqSchema,
  CertificateSignedResSchema,
);
