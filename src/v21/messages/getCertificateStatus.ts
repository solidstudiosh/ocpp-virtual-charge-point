import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { OCSPRequestDataTypeSchema, StatusInfoTypeSchema } from "./_common";

const GetCertificateStatusReqSchema = z.object({
  ocspRequestData: OCSPRequestDataTypeSchema,
});
type GetCertificateStatusReqType = typeof GetCertificateStatusReqSchema;

const GetCertificateStatusResSchema = z.object({
  status: z.enum(["Accepted", "Failed"]),
  ocspResult: z.string().max(18000).nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetCertificateStatusResType = typeof GetCertificateStatusResSchema;

class GetCertificateStatusOcppMessage extends OcppMessage<
  GetCertificateStatusReqType,
  GetCertificateStatusResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<GetCertificateStatusReqType>>,
    _result: OcppCallResult<z.infer<GetCertificateStatusResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const getCertificateStatusOcppMessage =
  new GetCertificateStatusOcppMessage(
    "GetCertificateStatus",
    GetCertificateStatusReqSchema,
    GetCertificateStatusResSchema,
  );
