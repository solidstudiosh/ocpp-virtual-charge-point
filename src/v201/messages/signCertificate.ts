import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";
import { logger } from "../../logger";

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

class SignCertificateOcppOutgoing extends OcppOutgoing<
  SignCertificateReqType,
  SignCertificateResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<SignCertificateReqType>>,
    result: OcppCallResult<z.infer<SignCertificateResType>>,
  ): Promise<void> => {
    logger.info(
      `[2.0.1] SignCertificate Response Received: ${JSON.stringify(result.payload)}`,
    );
  };
}

export const signCertificateOcppOutgoing = new SignCertificateOcppOutgoing(
  "SignCertificate",
  SignCertificateReqSchema,
  SignCertificateResSchema,
);
