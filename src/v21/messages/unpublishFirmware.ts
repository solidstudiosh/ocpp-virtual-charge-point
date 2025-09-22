import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const UnpublishFirmwareReqSchema = z.object({
  checksum: z.string().max(32),
});
type UnpublishFirmwareReqType = typeof UnpublishFirmwareReqSchema;

const UnpublishFirmwareResSchema = z.object({
  status: z.enum(["DownloadOngoing", "NoFirmware", "Unpublished"]),
});
type UnpublishFirmwareResType = typeof UnpublishFirmwareResSchema;

class UnpublishFirmwareOcppIncoming extends OcppIncoming<
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

export const unpublishFirmwareOcppIncoming = new UnpublishFirmwareOcppIncoming(
  "UnpublishFirmware",
  UnpublishFirmwareReqSchema,
  UnpublishFirmwareResSchema,
);
