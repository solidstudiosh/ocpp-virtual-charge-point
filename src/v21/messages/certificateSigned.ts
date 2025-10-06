import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const CertificateSignedReqSchema = z.object({
  certificateChain: z.string().max(10000),
  certificateType: z
    .enum(["ChargeStationCertificate", "V2GCertificate", "V2G20Certificate"])
    .nullish(),
  requestId: z.number().int().nullish(),
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
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const certificateSignedOcppIncoming = new CertificateSignedOcppIncoming(
  "CertificateSigned",
  CertificateSignedReqSchema,
  CertificateSignedResSchema,
);
