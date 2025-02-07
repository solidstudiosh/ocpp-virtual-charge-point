import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const SignCertificateReqSchema = z.object({
  csr: z.string().max(5500),
  certificateType: z
    .enum(["ChargingStationCertificate", "V2GCertificate"])
    .nullish(),
});
type SignCertificateReqType = typeof SignCertificateReqSchema;

const SignCertificateResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SignCertificateResType = typeof SignCertificateResSchema;

class SignCertificateOcppMessage extends OcppMessage<
  SignCertificateReqType,
  SignCertificateResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<SignCertificateReqType>>,
    _result: OcppCallResult<z.infer<SignCertificateResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const signCertificateOcppMessage = new SignCertificateOcppMessage(
  "SignCertificate",
  SignCertificateReqSchema,
  SignCertificateResSchema,
);
