import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  DERControlType,
  DERCurve,
  EnterService,
  FixedPF,
  FixedVar,
  FreqDroop,
  Gradient,
  LimitMaxDischarge,
  StatusInfoTypeSchema,
} from "./_common";

const SetDERControlReqSchema = z.object({
  isDefault: z.boolean(),
  controlId: z.string().max(36),
  controlType: DERControlType,
  curve: DERCurve.nullish(),
  fixedPFAbsorb: FixedPF.nullish(),
  fixedPFInject: FixedPF.nullish(),
  fixedVar: FixedVar.nullish(),
  limitMaxDischarge: LimitMaxDischarge.nullish(),
  freqDroop: FreqDroop.nullish(),
  enterService: EnterService.nullish(),
  gradient: Gradient.nullish(),
});
type SetDERControlReqType = typeof SetDERControlReqSchema;

const SetDERControlResSchema = z.object({
  status: z.enum(["Accepted", "Rejected"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SetDERControlResType = typeof SetDERControlResSchema;

class SetDERControlOcppIncoming extends OcppIncoming<
  SetDERControlReqType,
  SetDERControlResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetDERControlReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setDERControlOcppIncoming = new SetDERControlOcppIncoming(
  "SetDERControl",
  SetDERControlReqSchema,
  SetDERControlResSchema,
);
