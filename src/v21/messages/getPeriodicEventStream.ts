import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

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

class GetPeriodicEventStreamOcppIncoming extends OcppIncoming<
  GetPeriodicEventStreamReqType,
  GetPeriodicEventStreamResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetPeriodicEventStreamReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        constantStreamData: [
          {
            id: 1,
            variableMonitoringId: 1,
            params: {
              interval: 10,
              values: 10,
            },
          },
        ],
      }),
    );
  };
}

export const getPeriodicEventStreamOcppIncoming =
  new GetPeriodicEventStreamOcppIncoming(
    "GetPeriodicEventStream",
    GetPeriodicEventStreamReqSchema,
    GetPeriodicEventStreamResSchema,
  );
