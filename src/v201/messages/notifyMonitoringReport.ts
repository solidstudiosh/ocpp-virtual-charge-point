import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
import {
  ComponentTypeSchema,
  MonitorTypeSchema,
  VariableTypeSchema,
} from "./_common";

const NotifyMonitoringReportReqSchema = z.object({
  requestId: z.number().int(),
  tbc: z.boolean().nullish(),
  seqNo: z.number().int(),
  generatedAt: z.string().datetime(),
  monitor: z
    .array(
      z.object({
        component: ComponentTypeSchema,
        variable: VariableTypeSchema,
        variableMonitoring: z.array(
          z.object({
            id: z.number().int(),
            transaction: z.boolean(),
            value: z.number(),
            type: MonitorTypeSchema,
            severity: z.number().int().min(0).max(9),
          }),
        ),
      }),
    )
    .nullish(),
});
type NotifyMonitoringReportReqType = typeof NotifyMonitoringReportReqSchema;

const NotifyMonitoringReportResSchema = z.object({});
type NotifyMonitoringReportResType = typeof NotifyMonitoringReportResSchema;

class NotifyMonitoringReportOcppMessage extends OcppMessage<
  NotifyMonitoringReportReqType,
  NotifyMonitoringReportResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyMonitoringReportReqType>>,
    _result: OcppCallResult<z.infer<NotifyMonitoringReportResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyMonitoringReportOcppMessage =
  new NotifyMonitoringReportOcppMessage(
    "NotifyMonitoringReport",
    NotifyMonitoringReportReqSchema,
    NotifyMonitoringReportResSchema,
  );
