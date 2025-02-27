import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
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
            eventNotificationType: z.enum([
              "HardWiredNotification",
              "HardWiredMonitor",
              "PreconfiguredMonitor",
              "CustomMonitor",
            ]),
          }),
        ),
      }),
    )
    .nullish(),
});
type NotifyMonitoringReportReqType = typeof NotifyMonitoringReportReqSchema;

const NotifyMonitoringReportResSchema = z.object({});
type NotifyMonitoringReportResType = typeof NotifyMonitoringReportResSchema;

class NotifyMonitoringReportOcppOutgoing extends OcppOutgoing<
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

export const notifyMonitoringReportOcppOutgoing =
  new NotifyMonitoringReportOcppOutgoing(
    "NotifyMonitoringReport",
    NotifyMonitoringReportReqSchema,
    NotifyMonitoringReportResSchema,
  );
