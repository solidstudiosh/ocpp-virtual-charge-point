import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const GetDiagnosticsReqSchema = z.object({
  location: z.string().url(),
  retries: z.number().int().nullish(),
  retryInterval: z.number().int().nullish(),
  startTime: z.string().datetime().nullish(),
  stopTime: z.string().datetime().nullish(),
});
type GetDiagnosticsReqType = typeof GetDiagnosticsReqSchema;

const GetDiagnosticsResSchema = z.object({
  fileName: z.string().max(255).nullish(),
});
type GetDiagnosticsResType = typeof GetDiagnosticsResSchema;

class GetDiagnosticsOcppMessage extends OcppIncoming<
  GetDiagnosticsReqType,
  GetDiagnosticsResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetDiagnosticsReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        fileName: `diagnostics_${new Date().toISOString()}.log`,
      }),
    );
  };
}

export const getDiagnosticsOcppMessage = new GetDiagnosticsOcppMessage(
  "GetDiagnostics",
  GetDiagnosticsReqSchema,
  GetDiagnosticsResSchema,
);
