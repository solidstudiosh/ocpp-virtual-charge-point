import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  ComponentTypeSchema,
  MonitorTypeSchema,
  StatusInfoTypeSchema,
  VariableTypeSchema,
} from "./_common";

const SetVariableMonitoringReqSchema = z.object({
  setMonitoringData: z.array(
    z.object({
      id: z.number().int().nullish(),
      transaction: z.boolean().nullish(),
      value: z.number(),
      type: MonitorTypeSchema,
      severity: z.number().int().min(0).max(9),
      component: ComponentTypeSchema,
      variable: VariableTypeSchema,
      periodicEventStream: z
        .object({
          interval: z.number().int().nullish(),
          values: z.number().int().nullish(),
        })
        .nullish(),
    }),
  ),
});
type SetVariableMonitoringReqType = typeof SetVariableMonitoringReqSchema;

const SetVariableMonitoringResSchema = z.object({
  setMonitoringResult: z.array(
    z.object({
      id: z.number().int().nullish(),
      status: z.enum([
        "Accepted",
        "UnknownComponent",
        "UnknownVariable",
        "UnsupportedMonitorType",
        "Rejected",
        "Duplicate",
      ]),
      type: MonitorTypeSchema,
      severity: z.number().int().min(0).max(9).nullish(),
      component: ComponentTypeSchema,
      variable: VariableTypeSchema,
      statusInfo: StatusInfoTypeSchema.nullish(),
    }),
  ),
});
type SetVariableMonitoringResType = typeof SetVariableMonitoringResSchema;

class SetVariableMonitoringOcppIncoming extends OcppIncoming<
  SetVariableMonitoringReqType,
  SetVariableMonitoringResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetVariableMonitoringReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        setMonitoringResult: call.payload.setMonitoringData.map((data) => ({
          status: "Accepted",
          id: data.id,
          severity: data.severity,
          type: data.type,
          component: data.component,
          variable: data.variable,
        })),
      }),
    );
  };
}

export const setVariableMonitoringOcppIncoming =
  new SetVariableMonitoringOcppIncoming(
    "SetVariableMonitoring",
    SetVariableMonitoringReqSchema,
    SetVariableMonitoringResSchema,
  );
