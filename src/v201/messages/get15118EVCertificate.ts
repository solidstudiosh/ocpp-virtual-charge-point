import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const Get15118EVCertificateReqSchema = z.object({
  iso15118SchemaVersion: z.string().max(50),
  action: z.enum(["Install", "Update"]),
  exiRequest: z.string().max(5600),
});

type Get15118EVCertificateReqType = typeof Get15118EVCertificateReqSchema;

const Get15118EVCertificateResSchema = z.object({
  status: z.enum(["Accepted", "Failed"]),
  exiResponse: z.string().max(5600),
  statusInfo: StatusInfoTypeSchema.nullish(),
});

type Get15118EVCertificateResType = typeof Get15118EVCertificateResSchema;

class Get15118EVCertificateOcppIncoming extends OcppIncoming<
  Get15118EVCertificateReqType,
  Get15118EVCertificateResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<Get15118EVCertificateReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted", exiResponse: "" }));
  };
}

export const get15118EVCertificateOcppIncoming =
  new Get15118EVCertificateOcppIncoming(
    "Get15118EVCertificate",
    Get15118EVCertificateReqSchema,
    Get15118EVCertificateResSchema,
  );
