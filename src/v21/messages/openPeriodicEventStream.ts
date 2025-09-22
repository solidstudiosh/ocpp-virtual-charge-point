import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const OpenPeriodicEventStreamReqSchema = z.object({
  constantStreamData: z.object({
    id: z.number().int(),
    variableMonitoringId: z.number().int(),
    params: z.object({
      interval: z.number().int().nullish(),
      values: z.number().int().nullish(),
    }),
  }),
});
type OpenPeriodicEventStreamReqType = typeof OpenPeriodicEventStreamReqSchema;

const OpenPeriodicEventStreamResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type OpenPeriodicEventStreamResType = typeof OpenPeriodicEventStreamResSchema;

class OpenPeriodicEventStreamOcppOutgoing extends OcppOutgoing<
  OpenPeriodicEventStreamReqType,
  OpenPeriodicEventStreamResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<OpenPeriodicEventStreamReqType>>,
    _result: OcppCallResult<z.infer<OpenPeriodicEventStreamResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const openPeriodicEventStreamOcppOutgoing =
  new OpenPeriodicEventStreamOcppOutgoing(
    "OpenPeriodicEventStream",
    OpenPeriodicEventStreamReqSchema,
    OpenPeriodicEventStreamResSchema,
  );
