import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppIncoming,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const DataTransferReqSchema = z.object({
  messageId: z.string().max(50).nullish(),
  data: z.any().nullish(),
  vendorId: z.string().max(255),
});
type DataTransferReqType = typeof DataTransferReqSchema;

const DataTransferResSchema = z.object({
  status: z.enum([
    "Accepted",
    "Rejected",
    "UnknownMessageId",
    "UnknownVendorId",
  ]),
  data: z.any().nullish(),
  statusInfo: StatusInfoTypeSchema.nullish(),
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
