import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
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
} from "./_common";

const ReportDERControlReqSchema = z.object({
  requestId: z.number().int(),
  tbc: z.boolean().nullish(),
  fixedPFAbsorb: z
    .array(
      z.object({
        id: z.string().max(36),
        isDefault: z.boolean(),
        isSuperseded: z.boolean(),
        fixedPF: FixedPF,
      }),
    )
    .max(24)
    .nullish(),
  fixedPFInject: z
    .array(
      z.object({
        id: z.string().max(36),
        isDefault: z.boolean(),
        isSuperseded: z.boolean(),
        fixedPF: FixedPF,
      }),
    )
    .max(24)
    .nullish(),
  fixedVar: z
    .array(
      z.object({
        id: z.string().max(36),
        isDefault: z.boolean(),
        isSuperseded: z.boolean(),
        fixedVar: FixedVar,
      }),
    )
    .max(24)
    .nullish(),
  limitMaxDischarge: z
    .array(
      z.object({
        id: z.string().max(36),
        isDefault: z.boolean(),
        isSuperseded: z.boolean(),
        limitMaxDischarge: LimitMaxDischarge,
      }),
    )
    .max(24)
    .nullish(),
  freqDroop: z
    .array(
      z.object({
        id: z.string().max(36),
        isDefault: z.boolean(),
        isSuperseded: z.boolean(),
        freqDroop: FreqDroop,
      }),
    )
    .max(24)
    .nullish(),
  enterService: z
    .array(
      z.object({
        id: z.string().max(36),
        enterService: EnterService,
      }),
    )
    .max(24)
    .nullish(),
  gradient: z
    .array(
      z.object({
        id: z.string().max(36),
        gradient: Gradient,
      }),
    )
    .max(24)
    .nullish(),
  curve: z
    .array(
      z.object({
        id: z.string().max(36),
        curveType: DERControlType,
        isDefault: z.boolean(),
        isSuperseded: z.boolean(),
        curve: DERCurve,
      }),
    )
    .max(24)
    .nullish(),
});
type ReportDERControlReqType = typeof ReportDERControlReqSchema;

const ReportDERControlResSchema = z.object({});
type ReportDERControlResType = typeof ReportDERControlResSchema;

class ReportDERControlOcppOutgoing extends OcppOutgoing<
  ReportDERControlReqType,
  ReportDERControlResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<ReportDERControlReqType>>,
    _result: OcppCallResult<z.infer<ReportDERControlResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const reportDERControlOcppOutgoing = new ReportDERControlOcppOutgoing(
  "ReportDERControl",
  ReportDERControlReqSchema,
  ReportDERControlResSchema,
);
