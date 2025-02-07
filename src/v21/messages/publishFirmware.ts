import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const PublishFirmwareReqSchema = z.object({
  location: z.string().max(2000),
  retries: z.number().int().nullish(),
  checksum: z.string().max(32),
  requestId: z.number().int(),
  retryInterval: z.number().int().nullish(),
});
type PublishFirmwareReqType = typeof PublishFirmwareReqSchema;

const PublishFirmwareResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type PublishFirmwareResType = typeof PublishFirmwareResSchema;

class PublishFirmwareOcppMessage extends OcppMessage<
  PublishFirmwareReqType,
  PublishFirmwareResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<PublishFirmwareReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const publishFirmwareOcppMessage = new PublishFirmwareOcppMessage(
  "PublishFirmware",
  PublishFirmwareReqSchema,
  PublishFirmwareResSchema,
);
