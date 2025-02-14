import { z } from "zod";
import { type OcppCall, OcppMessage } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { CertificateHashDataTypeSchema, StatusInfoTypeSchema } from "./_common";

const DeleteCertificateReqSchema = z.object({
  certificateHashData: CertificateHashDataTypeSchema,
});
type DeleteCertificateReqType = typeof DeleteCertificateReqSchema;

const DeleteCertificateResSchema = z.object({
  status: z.enum(["Accepted", "Failed", "NotFound"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type DeleteCertificateResType = typeof DeleteCertificateResSchema;

class DeleteCertificateOcppMessage extends OcppMessage<
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
