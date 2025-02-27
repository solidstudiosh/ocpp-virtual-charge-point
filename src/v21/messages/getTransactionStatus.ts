import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const GetTransactionStatusReqSchema = z.object({
  transactionId: z.string().nullish(),
});
type GetTransactionStatusReqType = typeof GetTransactionStatusReqSchema;

const GetTransactionStatusResSchema = z.object({
  ongoingIndicator: z.boolean().nullish(),
  messagesInQueue: z.boolean(),
});
type GetTransactionStatusResType = typeof GetTransactionStatusResSchema;

class GetTransactionStatusOcppIncoming extends OcppIncoming<
  GetTransactionStatusReqType,
  GetTransactionStatusResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetTransactionStatusReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        messagesInQueue: false,
        ongoingIndicator: false,
      }),
    );
  };
}

export const getTransactionStatusOcppIncoming =
  new GetTransactionStatusOcppIncoming(
    "GetTransactionStatus",
    GetTransactionStatusReqSchema,
    GetTransactionStatusResSchema,
  );
