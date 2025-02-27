import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const GetLogReqSchema = z.object({
  logType: z.enum(["DiagnosticsLog", "SecurityLog"]),
  requestId: z.number().int(),
  retries: z.number().int().nullish(),
  retryInterval: z.number().int().nullish(),
  log: z.object({
    remoteLocation: z.string().max(512),
    oldestTimestamp: z.string().datetime().nullish(),
    latestTimestamp: z.string().datetime().nullish(),
  }),
});
type GetLogReqType = typeof GetLogReqSchema;

const GetLogResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "AcceptedCanceled"]),
  filename: z.string().max(255).nullish(),
});
type GetLogResType = typeof GetLogResSchema;

class GetLogOcppMessage extends OcppIncoming<GetLogReqType, GetLogResType> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetLogReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const getLogOcppMessage = new GetLogOcppMessage(
  "GetLog",
  GetLogReqSchema,
  GetLogResSchema,
);
