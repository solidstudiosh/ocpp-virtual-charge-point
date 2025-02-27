import { z } from "zod";
import { type OcppCall, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";

const GetConfigurationReqSchema = z.object({
  key: z.array(z.string().max(50)).nullish(),
});
type GetConfigurationReqType = typeof GetConfigurationReqSchema;

const GetConfigurationResSchema = z.object({
  configurationKey: z
    .array(
      z.object({
        key: z.string().max(50),
        readonly: z.boolean(),
        value: z.string().max(500).nullish(),
      }),
    )
    .nullish(),
  unknownKey: z.array(z.string().max(50)).nullish(),
});
type GetConfigurationResType = typeof GetConfigurationResSchema;

class GetConfigurationOcppMessage extends OcppIncoming<
  GetConfigurationReqType,
  GetConfigurationResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<GetConfigurationReqType>>,
  ): Promise<void> => {
    vcp.respond(
      this.response(call, {
        configurationKey: [
          {
            key: "SupportedFeatureProfiles",
            readonly: true,
            value:
              "Core,FirmwareManagement,LocalAuthListManagement,Reservation,SmartCharging,RemoteTrigger",
          },
          {
            key: "ChargeProfileMaxStackLevel",
            readonly: true,
            value: "99",
          },
          {
            key: "HeartbeatInterval",
            readonly: false,
            value: "300",
          },
          {
            key: "GetConfigurationMaxKeys",
            readonly: true,
            value: "99",
          },
        ],
        unknownKey: [],
      }),
    );
  };
}

export const getConfigurationOcppMessage = new GetConfigurationOcppMessage(
  "GetConfiguration",
  GetConfigurationReqSchema,
  GetConfigurationResSchema,
);
