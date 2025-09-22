import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { OCSPRequestDataTypeSchema, StatusInfoTypeSchema } from "./_common";

const GetCertificateStatusReqSchema = z.object({
  ocspRequestData: OCSPRequestDataTypeSchema,
});
type GetCertificateStatusReqType = typeof GetCertificateStatusReqSchema;

const GetCertificateStatusResSchema = z.object({
  status: z.enum(["Accepted", "Failed"]),
  ocspResult: z.string().max(5500).nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetCertificateStatusResType = typeof GetCertificateStatusResSchema;

class GetCertificateStatusOcppOutgoing extends OcppOutgoing<
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

export const getCertificateStatusOcppOutgoing =
  new GetCertificateStatusOcppOutgoing(
    "GetCertificateStatus",
    GetCertificateStatusReqSchema,
    GetCertificateStatusResSchema,
  );
