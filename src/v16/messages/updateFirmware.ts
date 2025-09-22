import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const UpdateFirmwareReqSchema = z.object({
  location: z.string().url(),
  retries: z.number().int().nullish(),
  retrieveDate: z.string().datetime(),
  retryInterval: z.number().int().nullish(),
});
type UpdateFirmwareReqType = typeof UpdateFirmwareReqSchema;

const UpdateFirmwareResSchema = z.object({});
type UpdateFirmwareResType = typeof UpdateFirmwareResSchema;

class UpdateFirmwareOcppMessage extends OcppIncoming<
  UpdateFirmwareReqType,
  UpdateFirmwareResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<UpdateFirmwareReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, {}));
  };
}

export const updateFirmwareOcppMessage = new UpdateFirmwareOcppMessage(
  "UpdateFirmware",
  UpdateFirmwareReqSchema,
  UpdateFirmwareResSchema,
);
