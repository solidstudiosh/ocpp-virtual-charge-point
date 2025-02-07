import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const ChangeConfigurationReqSchema = z.object({
  key: z.string().max(50),
  value: z.string().max(500),
});
type ChangeConfigurationReqType = typeof ChangeConfigurationReqSchema;

const ChangeConfigurationResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "RebootRequired", "NotSupported"]),
});
type ChangeConfigurationResType = typeof ChangeConfigurationResSchema;

class ChangeConfigurationOcppMessage extends OcppMessage<
  ChangeConfigurationReqType,
  ChangeConfigurationResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<ChangeConfigurationReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const changeConfigurationOcppMessage =
  new ChangeConfigurationOcppMessage(
    "ChangeConfiguration",
    ChangeConfigurationReqSchema,
    ChangeConfigurationResSchema,
  );
