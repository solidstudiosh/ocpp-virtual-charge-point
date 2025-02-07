import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { IdTagInfoSchema } from "./_common";

const AuthorizeReqSchema = z.object({
  idTag: z.string(),
});
type AuthorizeReqType = typeof AuthorizeReqSchema;

const AuthorizeResSchema = z.object({
  idTagInfo: IdTagInfoSchema,
});
type AuthorizeResType = typeof AuthorizeResSchema;

class AuthorizeOcppMessage extends OcppMessage<
  AuthorizeReqType,
  AuthorizeResType
> {
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
