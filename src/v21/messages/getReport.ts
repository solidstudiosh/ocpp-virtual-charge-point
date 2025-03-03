import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  ComponentTypeSchema,
  StatusInfoTypeSchema,
  VariableTypeSchema,
} from "./_common";
import { notifyReportOcppOutgoing } from "./notifyReport";

const GetReportReqSchema = z.object({
  requestId: z.number().int(),
  componentCriteria: z
    .array(z.enum(["Active", "Available", "Enabled", "Problem"]))
    .max(4)
    .nullish(),
  componentVariable: z
    .array(
      z.object({
        component: ComponentTypeSchema,
        variable: VariableTypeSchema.nullish(),
      }),
    )
    .nullish(),
});
type GetReportReqType = typeof GetReportReqSchema;

const GetReportResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "NotSupported", "EmptyResultSet"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type GetReportResType = typeof GetReportResSchema;

class GetReportOcppIncoming extends OcppIncoming<
  GetReportReqType,
  GetReportResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetReportReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
    vcp.send(
      notifyReportOcppOutgoing.request({
        generatedAt: new Date().toISOString(),
        requestId: call.payload.requestId,
        seqNo: 1,
        reportData: [],
      }),
    );
  };
}

export const getReportOcppIncoming = new GetReportOcppIncoming(
  "GetReport",
  GetReportReqSchema,
  GetReportResSchema,
);
