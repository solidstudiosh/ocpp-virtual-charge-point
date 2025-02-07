import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";

const UnpublishFirmwareReqSchema = z.object({
  checksum: z.string().max(32),
});
type UnpublishFirmwareReqType = typeof UnpublishFirmwareReqSchema;

const UnpublishFirmwareResSchema = z.object({
  status: z.enum(["DownloadOngoing", "NoFirmware", "Unpublished"]),
});
type UnpublishFirmwareResType = typeof UnpublishFirmwareResSchema;

class UnpublishFirmwareOcppMessage extends OcppMessage<
  UnpublishFirmwareReqType,
  UnpublishFirmwareResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<UnpublishFirmwareReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Unpublished" }));
  };
}

export const unpublishFirmwareOcppMessage = new UnpublishFirmwareOcppMessage(
  "UnpublishFirmware",
  UnpublishFirmwareReqSchema,
  UnpublishFirmwareResSchema,
);
