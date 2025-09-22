import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const DeleteCertificateReqSchema = z.object({
  certificateHashData: z.object({
    hashAlgorithm: z.enum(["SHA256", "SHA384", "SHA512"]),
    issuerNameHash: z.string(),
    issuerKeyHash: z.string(),
    serialNumber: z.string(),
  }),
});
type DeleteCertificateReqType = typeof DeleteCertificateReqSchema;

const DeleteCertificateResSchema = z.object({
  status: z.enum(["Accepted", "Failed"]),
});
type DeleteCertificateResType = typeof DeleteCertificateResSchema;

class DeleteCertificateOcppMessage extends OcppIncoming<
  DeleteCertificateReqType,
  DeleteCertificateResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<DeleteCertificateReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const deleteCertificateOcppMessage = new DeleteCertificateOcppMessage(
  "DeleteCertificate",
  DeleteCertificateReqSchema,
  DeleteCertificateResSchema,
);
