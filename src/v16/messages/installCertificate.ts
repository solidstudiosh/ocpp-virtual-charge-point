import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const InstallCertificateReqSchema = z.object({
  certificateType: z.enum([
    "CentralSystemRootCertificate",
    "ManufacturerRootCertificate",
  ]),
  certificate: z.string().max(5500),
});
type InstallCertificateReqType = typeof InstallCertificateReqSchema;

const InstallCertificateResSchema = z.object({
  status: z.enum(["Accepted", "Failed", "Rejected"]),
});
type InstallCertificateResType = typeof InstallCertificateResSchema;

class InstallCertificateOcppMessage extends OcppIncoming<
  InstallCertificateReqType,
  InstallCertificateResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<InstallCertificateReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Rejected" }));
  };
}

export const installCertificateOcppMessage = new InstallCertificateOcppMessage(
  "InstallCertificate",
  InstallCertificateReqSchema,
  InstallCertificateResSchema,
);
