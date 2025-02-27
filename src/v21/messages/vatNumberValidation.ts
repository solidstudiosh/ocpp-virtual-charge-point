import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const VatNumberValidationReqSchema = z.object({
  vatNumber: z.string().max(20),
  evseId: z.number().int().nullish(),
});
type VatNumberValidationReqType = typeof VatNumberValidationReqSchema;

const VatNumberValidationResSchema = z.object({
  vatNumber: z.string().max(20),
  evseId: z.number().int().nullish(),
  status: GenericStatusEnumSchema,
  company: z
    .object({
      name: z.string().max(50),
      address1: z.string().max(100),
      address2: z.string().max(100).nullish(),
      city: z.string().max(100),
      postalCode: z.string().max(20).nullish(),
      country: z.string().max(50),
    })
    .nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type VatNumberValidationResType = typeof VatNumberValidationResSchema;

class VatNumberValidationOcppOutgoing extends OcppOutgoing<
  VatNumberValidationReqType,
  VatNumberValidationResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<VatNumberValidationReqType>>,
    _result: OcppCallResult<z.infer<VatNumberValidationResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const vatNumberValidationOcppOutgoing =
  new VatNumberValidationOcppOutgoing(
    "VatNumberValidation",
    VatNumberValidationReqSchema,
    VatNumberValidationResSchema,
  );
