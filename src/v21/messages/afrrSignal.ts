import { z } from "zod";
import { OcppCall, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class AFRRSignalOcppMessage extends OcppMessage<
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

export const afrrSignalOcppMessage = new AFRRSignalOcppMessage(
  "AFRRSignal",
  AFRRSignalReqSchema,
  AFRRSignalResSchema,
);
