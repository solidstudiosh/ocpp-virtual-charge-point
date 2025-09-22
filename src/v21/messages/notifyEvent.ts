import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ComponentTypeSchema, VariableTypeSchema } from "./_common";

const NotifyEventReqSchema = z.object({
  generatedAt: z.string().datetime(),
  tbc: z.boolean().nullish(),
  seqNo: z.number().int(),
  eventData: z.array(
    z.object({
      eventId: z.number().int(),
      timestamp: z.string().datetime(),
      trigger: z.enum(["Alerting", "Delta", "Periodic"]),
      cause: z.number().int().nullish(),
      actualValue: z.string().max(2500),
      techCode: z.string().max(50).nullish(),
      techInfo: z.string().max(500).nullish(),
      cleared: z.boolean().nullish(),
      transactionId: z.string().max(36).nullish(),
      variableMonitoringId: z.number().int().nullish(),
      eventNotificationType: z.enum([
        "HardWiredNotification",
        "HardWiredMonitor",
        "PreconfiguredMonitor",
        "CustomMonitor",
      ]),
      severity: z.number().int().nullish(),
      component: ComponentTypeSchema,
      variable: VariableTypeSchema,
    }),
  ),
});
type NotifyEventReqType = typeof NotifyEventReqSchema;

const NotifyEventResSchema = z.object({});
type NotifyEventResType = typeof NotifyEventResSchema;

class NotifyEventOcppOutgoing extends OcppOutgoing<
  NotifyEventReqType,
  NotifyEventResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyEventReqType>>,
    _result: OcppCallResult<z.infer<NotifyEventResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyEventOcppOutgoing = new NotifyEventOcppOutgoing(
  "NotifyEvent",
  NotifyEventReqSchema,
  NotifyEventResSchema,
);
