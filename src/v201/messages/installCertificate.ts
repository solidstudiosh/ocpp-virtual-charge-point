import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const InstallCertificateReqSchema = z.object({
  certificateType: z.enum([
    "V2GRootCertificate",
    "MORootCertificate",
    "CSMSRootCertificate",
    "ManufacturerRootCertificate",
  ]),
  certificate: z.string(),
});
type InstallCertificateReqType = typeof InstallCertificateReqSchema;

const InstallCertificateResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Failed"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type InstallCertificateResType = typeof InstallCertificateResSchema;

class InstallCertificateOcppIncoming extends OcppIncoming<
  InstallCertificateReqType,
  InstallCertificateResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<InstallCertificateReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const installCertificateOcppIncoming =
  new InstallCertificateOcppIncoming(
    "InstallCertificate",
    InstallCertificateReqSchema,
    InstallCertificateResSchema,
  );
