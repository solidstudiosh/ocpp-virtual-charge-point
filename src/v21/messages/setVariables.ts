import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  ComponentTypeSchema,
  StatusInfoTypeSchema,
  VariableTypeSchema,
} from "./_common";

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
        setVariableResult: call.payload.setVariableData.map((data) => ({
          attributeType: data.attributeType,
          attributeStatus: "Accepted",
          component: data.component,
          variable: data.variable,
        })),
      }),
    );
  };
}

export const setVariablesOcppIncoming = new SetVariablesOcppIncoming(
  "SetVariables",
  SetVariablesReqSchema,
  SetVariablesResSchema,
);
