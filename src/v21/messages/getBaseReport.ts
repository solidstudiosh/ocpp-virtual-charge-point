import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";
import { notifyReportOcppOutgoing } from "./notifyReport";
import { dbService } from "../../database";

const GetBaseReportReqSchema = z.object({
  requestId: z.number().int(),
  reportBase: z.enum([
    "ConfigurationInventory",
    "FullInventory",
    "SummaryInventory",
  ]),
});
type GetBaseReportReqType = typeof GetBaseReportReqSchema;

const GetBaseReportResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotSupported", "EmptyResultSet"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetBaseReportResType = typeof GetBaseReportResSchema;

class GetBaseReportOcppIncoming extends OcppIncoming<
  GetBaseReportReqType,
  GetBaseReportResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetBaseReportReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));

    const configs = dbService.getAllConfigurations();

    // Send NotifyReport
    vcp.send(
      notifyReportOcppOutgoing.request({
        requestId: call.payload.requestId,
        generatedAt: new Date().toISOString(),
        seqNo: 0,
        tbc: false,
        reportData: configs.map(config => {
          const parts = config.key.split('.');
          const componentName = parts.length > 1 ? parts[0] : "OCPPCommCtrlr";
          const variableName = parts.length > 1 ? parts.slice(1).join('.') : config.key;

          return {
            component: {
              name: componentName,
            },
            variable: {
              name: variableName,
            },
            variableAttribute: [
              {
                type: "Actual",
                value: config.value,
                mutability: config.readonly ? "ReadOnly" : "ReadWrite",
                persistent: true,
                constant: false,
              },
            ],
            variableCharacteristics: {
              dataType: "string" as const,
              supportsMonitoring: false,
            },
          };
        }),
      }),
    );
  };
}

export const getBaseReportOcppIncoming = new GetBaseReportOcppIncoming(
  "GetBaseReport",
  GetBaseReportReqSchema,
  GetBaseReportResSchema,
);
