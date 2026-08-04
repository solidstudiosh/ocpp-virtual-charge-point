import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import { resolveTokenPlaceholder } from "../../tokenPlaceholder";
import type { VCP } from "../../vcp";
import { IdTagInfoSchema } from "./_common";

const AuthorizeReqSchema = z.object({
  idTag: z.string(),
});
type AuthorizeReqType = typeof AuthorizeReqSchema;

const AuthorizeResSchema = z.object({
  idTagInfo: IdTagInfoSchema,
});
type AuthorizeResType = typeof AuthorizeResSchema;

class AuthorizeOcppMessage extends OcppOutgoing<
  AuthorizeReqType,
  AuthorizeResType
> {
  beforeSend = (
    _vcp: VCP,
    payload: z.infer<AuthorizeReqType>,
  ): z.infer<AuthorizeReqType> => {
    return { ...payload, idTag: resolveTokenPlaceholder(payload.idTag) };
  };

  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<AuthorizeReqType>>,
    _result: OcppCallResult<z.infer<AuthorizeResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const authorizeOcppMessage = new AuthorizeOcppMessage(
  "Authorize",
  AuthorizeReqSchema,
  AuthorizeResSchema,
);
