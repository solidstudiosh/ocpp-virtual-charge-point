import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const GetPeriodicEventStreamReqSchema = z.object({});
type GetPeriodicEventStreamReqType = typeof GetPeriodicEventStreamReqSchema;

const GetPeriodicEventStreamResSchema = z.object({
  constantStreamData: z
    .array(
      z.object({
        id: z.number().int(),
        variableMonitoringId: z.number().int(),
        params: z.object({
          interval: z.number().int().nullish(),
          values: z.number().int().nullish(),
        }),
      }),
    )
    .nullish(),
});
type GetPeriodicEventStreamResType = typeof GetPeriodicEventStreamResSchema;

class GetPeriodicEventStreamOcppMessage extends OcppMessage<
  GetPeriodicEventStreamReqType,
  GetPeriodicEventStreamResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetPeriodicEventStreamReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { constantStreamData: [] }));
  };
}

export const getPeriodicEventStreamOcppMessage =
  new GetPeriodicEventStreamOcppMessage(
    "GetPeriodicEventStream",
    GetPeriodicEventStreamReqSchema,
    GetPeriodicEventStreamResSchema,
  );
