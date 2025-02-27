import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { GenericStatusEnumSchema, StatusInfoTypeSchema } from "./_common";

const AFRRSignalReqSchema = z.object({
  timestamp: z.string().datetime(),
  signal: z.number().int(),
});
type AFRRSignalReqType = typeof AFRRSignalReqSchema;

const AFRRSignalResSchema = z.object({
  status: GenericStatusEnumSchema,
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type AFRRSignalResType = typeof AFRRSignalResSchema;

class AFRRSignalOcppIncoming extends OcppIncoming<
  AFRRSignalReqType,
  AFRRSignalResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<AFRRSignalReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const afrrSignalOcppIncoming = new AFRRSignalOcppIncoming(
  "AFRRSignal",
  AFRRSignalReqSchema,
  AFRRSignalResSchema,
);
