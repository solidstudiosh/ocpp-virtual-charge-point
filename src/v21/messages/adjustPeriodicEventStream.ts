import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import {
  GenericStatusEnumSchema,
  PeriodicEventStreamParams,
  StatusInfoTypeSchema,
} from "./_common";

const AdjustPeriodicEventStreamReqSchema = z.object({
  id: z.number().int().nonnegative(),
  params: PeriodicEventStreamParams,
});
type AdjustPeriodicEventStreamReqType =
  typeof AdjustPeriodicEventStreamReqSchema;

const AdjustPeriodicEventStreamResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type AdjustPeriodicEventStreamResType =
  typeof AdjustPeriodicEventStreamResSchema;

class AdjustPeriodicEventStreamOcppMessage extends OcppMessage<
  AdjustPeriodicEventStreamReqType,
  AdjustPeriodicEventStreamResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<AdjustPeriodicEventStreamReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const adjustPeriodicEventStreamOcppMessage =
  new AdjustPeriodicEventStreamOcppMessage(
    "AdjustPeriodicEventStream",
    AdjustPeriodicEventStreamReqSchema,
    AdjustPeriodicEventStreamResSchema,
  );
