import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const UpdateFirmwareReqSchema = z.object({
  retries: z.number().int().nullish(),
  retryInterval: z.number().int().nullish(),
  requestId: z.number().int(),
  firmware: z.object({
    location: z.string().max(2000),
    retrieveDateTime: z.string().datetime(),
    installDateTime: z.string().datetime().nullish(),
    signingCertificate: z.string().max(5500).nullish(),
    signature: z.string().max(800).nullish(),
  }),
});
type UpdateFirmwareReqType = typeof UpdateFirmwareReqSchema;

const UpdateFirmwareResSchema = z.object({
  status: z.enum([
    "Accepted",
    "Rejected",
    "AcceptedCanceled",
    "InvalidCertificate",
    "RevokedCertificate",
  ]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type UpdateFirmwareResType = typeof UpdateFirmwareResSchema;

class UpdateFirmwareOcppIncoming extends OcppIncoming<
  UpdateFirmwareReqType,
  UpdateFirmwareResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<UpdateFirmwareReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const updateFirmwareOcppIncoming = new UpdateFirmwareOcppIncoming(
  "UpdateFirmware",
  UpdateFirmwareReqSchema,
  UpdateFirmwareResSchema,
);
