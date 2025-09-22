import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
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

class AdjustPeriodicEventStreamOcppIncoming extends OcppIncoming<
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

export const adjustPeriodicEventStreamOcppIncoming =
  new AdjustPeriodicEventStreamOcppIncoming(
    "AdjustPeriodicEventStream",
    AdjustPeriodicEventStreamReqSchema,
    AdjustPeriodicEventStreamResSchema,
  );
