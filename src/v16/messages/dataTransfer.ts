import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppIncoming,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";

const DataTransferReqSchema = z.object({
  vendorId: z.string().max(255),
  messageId: z.string().max(50).nullish(),
  data: z.string().nullish(),
});
type DataTransferReqType = typeof DataTransferReqSchema;

const DataTransferResSchema = z.object({
  status: z.enum([
    "Accepted",
    "Rejected",
    "UnknownMessageId",
    "UnknownVendorId",
  ]),
  data: z.string().nullish(),
});
type DataTransferResType = typeof DataTransferResSchema;

class DataTransferIncomingOcppMessage extends OcppIncoming<
  DataTransferReqType,
  DataTransferResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<DataTransferReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

class DataTransferOutgoingOcppMessage extends OcppOutgoing<
  DataTransferReqType,
  DataTransferResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<DataTransferReqType>>,
    _result: OcppCallResult<z.infer<DataTransferResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const dataTransferIncomingOcppMessage =
  new DataTransferIncomingOcppMessage(
    "DataTransfer",
    DataTransferReqSchema,
    DataTransferResSchema,
  );

export const dataTransferOutgoingOcppMessage =
  new DataTransferOutgoingOcppMessage(
    "DataTransfer",
    DataTransferReqSchema,
    DataTransferResSchema,
  );
