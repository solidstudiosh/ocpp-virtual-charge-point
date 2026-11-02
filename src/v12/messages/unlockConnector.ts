import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema } from "./_common";

const UnlockConnectorReqSchema = z.object({ connectorId: ConnectorIdSchema });
type UnlockConnectorReqType = typeof UnlockConnectorReqSchema;

// 1.2 answers Accepted/Rejected (1.6 uses Unlocked/UnlockFailed).
const UnlockConnectorResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
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
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const unlockConnectorOcppMessage = new UnlockConnectorOcppMessage(
  "UnlockConnector",
  UnlockConnectorReqSchema,
  UnlockConnectorResSchema,
);
