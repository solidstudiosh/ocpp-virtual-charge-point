import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  ComponentTypeSchema,
  StatusInfoTypeSchema,
  VariableTypeSchema,
} from "./_common";

const GetVariablesReqSchema = z.object({
  getVariableData: z
    .array(
      z.object({
        attributeType: z
          .enum(["Actual", "Target", "MinSet", "MaxSet"])
          .nullish(),
        component: ComponentTypeSchema,
        variable: VariableTypeSchema,
      }),
    )
    .nonempty(),
});
type GetVariablesReqType = typeof GetVariablesReqSchema;

const GetVariablesResSchema = z.object({
  getVariableResult: z.array(
    z.object({
      attributeStatus: z.enum([
        "Accepted",
        "Rejected",
        "UnknownComponent",
        "UnknownVariable",
        "NotSupportedAttributeType",
      ]),
      attributeType: z.enum(["Actual", "Target", "MinSet", "MaxSet"]).nullish(),
      attributeValue: z.string().max(2500).nullish(),
      component: ComponentTypeSchema,
      variable: VariableTypeSchema,
      attributeStatusInfo: StatusInfoTypeSchema.nullish(),
    }),
  ),
});
type GetVariablesResType = typeof GetVariablesResSchema;

class GetVariablesOcppIncoming extends OcppIncoming<
  GetVariablesReqType,
  GetVariablesResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetVariablesReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        getVariableResult: call.payload.getVariableData.map((data) => ({
          attributeStatus: "Accepted",
          attributeType: data.attributeType,
          component: data.component,
          variable: data.variable,
        })),
      }),
    );
  };
}

export const getVariablesOcppIncoming = new GetVariablesOcppIncoming(
  "GetVariables",
  GetVariablesReqSchema,
  GetVariablesResSchema,
);
