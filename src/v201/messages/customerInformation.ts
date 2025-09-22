import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import { IdTokenSchema } from "../../v16/messages/_common";
import type { VCP } from "../../vcp";
import { CertificateHashDataTypeSchema, StatusInfoTypeSchema } from "./_common";

const CustomerInformationReqSchema = z.object({
  requestId: z.number().int(),
  report: z.boolean(),
  clear: z.boolean(),
  customerIdentifier: z.string().max(64).nullish(),
  idToken: IdTokenSchema.nullish(),
  customerCertificate: CertificateHashDataTypeSchema.nullish(),
});
type CustomerInformationReqType = typeof CustomerInformationReqSchema;

const CustomerInformationResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Invalid"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type CustomerInformationResType = typeof CustomerInformationResSchema;

class CustomerInformationOcppIncoming extends OcppIncoming<
  CustomerInformationReqType,
  CustomerInformationResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<CustomerInformationReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const customerInformationOcppIncoming =
  new CustomerInformationOcppIncoming(
    "CustomerInformation",
    CustomerInformationReqSchema,
    CustomerInformationResSchema,
  );
