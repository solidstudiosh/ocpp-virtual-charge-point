import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const UnlockConnectorReqSchema = z.object({
  evseId: z.number().int(),
  connectorId: z.number().int(),
});
type UnlockConnectorReqType = typeof UnlockConnectorReqSchema;

const UnlockConnectorResSchema = z.object({
  status: z.enum([
    "Unlocked",
    "UnlockFailed",
    "OngoingAuthorizedTransaction",
    "UnknownConnector",
  ]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type UnlockConnectorResType = typeof UnlockConnectorResSchema;

class UnlockConnectorOcppIncoming extends OcppIncoming<
  UnlockConnectorReqType,
  UnlockConnectorResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<UnlockConnectorReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Unlocked" }));
  };
}

export const unlockConnectorOcppIncoming = new UnlockConnectorOcppIncoming(
  "UnlockConnector",
  UnlockConnectorReqSchema,
  UnlockConnectorResSchema,
);
