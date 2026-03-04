import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  ComponentTypeSchema,
  StatusInfoTypeSchema,
  VariableTypeSchema,
} from "./_common";
import { dbService } from "../../database";
import { logger } from "../../logger";

const SetVariablesReqSchema = z.object({
  setVariableData: z.array(
    z.object({
      attributeType: z.enum(["Actual", "Target", "MinSet", "MaxSet"]).nullish(),
      attributeValue: z.string().max(2500),
      component: ComponentTypeSchema,
      variable: VariableTypeSchema,
    }),
  ),
});
type SetVariablesReqType = typeof SetVariablesReqSchema;

const SetVariablesResSchema = z.object({
  setVariableResult: z.array(
    z.object({
      attributeType: z.enum(["Actual", "Target", "MinSet", "MaxSet"]).nullish(),
      attributeStatus: z.enum([
        "Accepted",
        "Rejected",
        "UnknownComponent",
        "UnknownVariable",
        "NotSupportedAttributeType",
        "RebootRequired",
      ]),
      component: ComponentTypeSchema,
      variable: VariableTypeSchema,
      attributeStatusInfo: StatusInfoTypeSchema.nullish(),
    }),
  ),
});
type SetVariablesResType = typeof SetVariablesResSchema;

class SetVariablesOcppIncoming extends OcppIncoming<
  SetVariablesReqType,
  SetVariablesResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetVariablesReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        setVariableResult: call.payload.setVariableData.map((data) => {
          const key = `${data.component.name}.${data.variable.name}`;
          const config = dbService.getConfiguration(key);

          if (!config) {
            // For the simulator, accept and create unknown variables dynamically
            dbService.setConfiguration(key, data.attributeValue, 0);
            logger.info(`[2.1] Created Device Model Variable ${key} = ${data.attributeValue}`);
            return {
              attributeStatus: "Accepted",
              attributeType: data.attributeType || "Actual",
              component: data.component,
              variable: data.variable,
            };
          } else if (config.readonly) {
            return {
              attributeStatus: "Rejected",
              attributeType: data.attributeType || "Actual",
              component: data.component,
              variable: data.variable,
            };
          } else {
            dbService.setConfiguration(key, data.attributeValue, 0);
            logger.info(`[2.1] Updated Device Model Variable ${key} to ${data.attributeValue}`);
            return {
              attributeStatus: "Accepted",
              attributeType: data.attributeType || "Actual",
              component: data.component,
              variable: data.variable,
            };
          }
        }),
      }),
    );
  };
}

export const setVariablesOcppIncoming = new SetVariablesOcppIncoming(
  "SetVariables",
  SetVariablesReqSchema,
  SetVariablesResSchema,
);
