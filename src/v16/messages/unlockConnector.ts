import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema } from "./_common";

const UnlockConnectorReqSchema = z.object({
  connectorId: ConnectorIdSchema,
});
type UnlockConnectorReqType = typeof UnlockConnectorReqSchema;

const UnlockConnectorResSchema = z.object({
  status: z.enum(["Unlocked", "UnlockFailed", "NotSupported"]),
});
type UnlockConnectorResType = typeof UnlockConnectorResSchema;

class UnlockConnectorOcppMessage extends OcppIncoming<
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

export const unlockConnectorOcppMessage = new UnlockConnectorOcppMessage(
  "UnlockConnector",
  UnlockConnectorReqSchema,
  UnlockConnectorResSchema,
);
