import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";
import { notifyReportOcppOutgoing } from "./notifyReport";

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

    // Send NotifyReport
    vcp.send(
      notifyReportOcppOutgoing.request({
        requestId: call.payload.requestId,
        generatedAt: new Date().toISOString(),
        seqNo: 0,
        tbc: false,
        reportData: [
          {
            component: {
              name: "OCPPCommCtrlr",
            },
            variable: {
              name: "HeartbeatInterval",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "60",
                mutability: "ReadWrite",
                persistent: true,
                constant: false,
              },
            ],
            variableCharacteristics: {
              unit: "s",
              dataType: "integer",
              supportsMonitoring: false,
            },
          },
          {
            component: {
              name: "AuthCtrlr",
            },
            variable: {
              name: "AuthorizeRemoteStart",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "false",
                mutability: "ReadWrite",
                persistent: true,
                constant: true,
              },
            ],
            variableCharacteristics: {
              dataType: "boolean",
              supportsMonitoring: false,
            },
          },
          {
            component: {
              name: "AuthCtrlr",
            },
            variable: {
              name: "LocalPreAuthorize",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "false",
                mutability: "ReadWrite",
                persistent: true,
                constant: true,
              },
            ],
            variableCharacteristics: {
              dataType: "boolean",
              supportsMonitoring: false,
            },
          },
          {
            component: {
              name: "TxCtrlr",
            },
            variable: {
              name: "EVConnectionTimeOut",
            },
            variableAttribute: [
              {
                type: "Actual",
                value: "10",
                mutability: "ReadWrite",
                persistent: true,
                constant: false,
              },
            ],
            variableCharacteristics: {
              dataType: "integer",
              supportsMonitoring: false,
            },
          },
        ],
      }),
    );
  };
}

export const getBaseReportOcppIncoming = new GetBaseReportOcppIncoming(
  "GetBaseReport",
  GetBaseReportReqSchema,
  GetBaseReportResSchema,
);
