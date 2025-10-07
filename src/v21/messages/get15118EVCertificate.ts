import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const Get15118EVCertificateReqSchema = z.object({
  iso15118SchemaVersion: z.string().max(50),
  action: z.enum(["Install", "Update"]),
  exiRequest: z.string().max(11000),
  maximumContractCertificateChains: z.number().int().nullish(),
  prioritizedEMAIDs: z.array(z.string().max(255)).max(8).nullish(),
});
type Get15118EVCertificateReqType = typeof Get15118EVCertificateReqSchema;

const Get15118EVCertificateResSchema = z.object({
  status: z.enum(["Accepted", "Failed"]),
  exiResponse: z.string().max(17000),
  remainingContracts: z.number().int().nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type Get15118EVCertificateResType = typeof Get15118EVCertificateResSchema;

class Get15118EVCertificateOcppOutgoing extends OcppOutgoing<
  Get15118EVCertificateReqType,
  Get15118EVCertificateResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<Get15118EVCertificateReqType>>,
    _result: OcppCallResult<z.infer<Get15118EVCertificateResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const get15118EVCertificateOcppOutgoing =
  new Get15118EVCertificateOcppOutgoing(
    "Get15118EVCertificate",
    Get15118EVCertificateReqSchema,
    Get15118EVCertificateResSchema,
  );
