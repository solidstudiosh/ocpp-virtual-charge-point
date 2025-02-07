import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class InstallCertificateOcppMessage extends OcppMessage<
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

export const installCertificateOcppMessage = new InstallCertificateOcppMessage(
  "InstallCertificate",
  InstallCertificateReqSchema,
  InstallCertificateResSchema,
);
