import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import { ComponentTypeSchema, VariableTypeSchema } from "./_common";

const NotifyReportReqSchema = z.object({
  requestId: z.number().int(),
  generatedAt: z.string().datetime(),
  tbc: z.boolean().nullish(),
  seqNo: z.number().int(),
  reportData: z
    .array(
      z.object({
        component: ComponentTypeSchema,
        variable: VariableTypeSchema,
        variableAttribute: z
          .array(
            z.object({
              type: z.enum(["Actual", "Target", "MinSet", "MaxSet"]).nullish(),
              value: z.string().max(2500).nullish(),
              mutability: z
                .enum(["ReadOnly", "WriteOnly", "ReadWrite"])
                .nullish(),
              persistent: z.boolean().nullish(),
              constant: z.boolean().nullish(),
            }),
          )
          .min(1)
          .max(4),
        variableCharacteristics: z
          .object({
            unit: z.string().max(16).nullish(),
            dataType: z.enum([
              "string",
              "decimal",
              "integer",
              "dateTime",
              "boolean",
              "OptionList",
              "SequenceList",
              "MemberList",
            ]),
            minLimit: z.number().nullish(),
            maxLimit: z.number().nullish(),
            maxElements: z.number().int().nullish(),
            valuesList: z.string().max(1000).nullish(),
            supportsMonitoring: z.boolean(),
          })
          .nullish(),
      }),
    )
    .nullish(),
});
type NotifyReportReqType = typeof NotifyReportReqSchema;

const NotifyReportResSchema = z.object({});
type NotifyReportResType = typeof NotifyReportResSchema;

class NotifyReportOcppMessage extends OcppMessage<
  NotifyReportReqType,
  NotifyReportResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyReportReqType>>,
    _result: OcppCallResult<z.infer<NotifyReportResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyReportOcppMessage = new NotifyReportOcppMessage(
  "NotifyReport",
  NotifyReportReqSchema,
  NotifyReportResSchema,
);
