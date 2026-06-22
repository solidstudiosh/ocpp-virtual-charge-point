import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { setConfiguration } from "../configurationStore";

const ChangeConfigurationReqSchema = z.object({
  key: z.string().max(50),
  value: z.string().max(500),
});
type ChangeConfigurationReqType = typeof ChangeConfigurationReqSchema;

const ChangeConfigurationResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "RebootRequired", "NotSupported"]),
});
type ChangeConfigurationResType = typeof ChangeConfigurationResSchema;

class ChangeConfigurationOcppMessage extends OcppIncoming<
  ChangeConfigurationReqType,
  ChangeConfigurationResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ChangeConfigurationReqType>>,
  ): Promise<void> => {
    const status = setConfiguration(call.payload.key, call.payload.value);
    vcp.respond(this.response(call, { status }));
  };
}

export const changeConfigurationOcppMessage =
  new ChangeConfigurationOcppMessage(
    "ChangeConfiguration",
    ChangeConfigurationReqSchema,
    ChangeConfigurationResSchema,
  );
