import { z } from "zod";
import { type OcppCall, OcppCallResult, OcppIncoming } from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const SetNetworkProfileReqSchema = z.object({
  configurationSlot: z.number().int(),
  connectionData: z.object({
    ocppVersion: z.enum(["OCPP12", "OCPP15", "OCPP16", "OCPP20"]),
    ocppTransport: z.enum(["JSON", "SOAP"]),
    ocppCsmsUrl: z.string().url().max(512),
    messageTimeout: z.number().int(),
    securityProfile: z.number().int(),
    ocppInterface: z.enum([
      "Wired0",
      "Wired1",
      "Wired2",
      "Wired3",
      "Wireless0",
      "Wireless1",
      "Wireless2",
      "Wireless3",
    ]),
    vpn: z
      .object({
        server: z.string().url().max(512),
        user: z.string().max(20),
        group: z.string().max(20).nullish(),
        password: z.string(),
        key: z.string().max(255),
        type: z.enum(["IKEv2", "IPSec", "L2TP", "PPTP"]),
      })
      .nullish(),
    apn: z
      .object({
        apn: z.string().max(512),
        apnUserName: z.string().max(20).nullish(),
        apnPassword: z.string().max(20).nullish(),
        simPin: z.number().int().nullish(),
        preferredNetwork: z.string().max(6).nullish(),
        useOnlyPreferredNetwork: z.boolean().nullish(),
        apnAuthentication: z.enum(["CHAP", "NONE", "PAP", "AUTO"]),
      })
      .nullish(),
  }),
});
type SetNetworkProfileReqType = typeof SetNetworkProfileReqSchema;

const SetNetworkProfileResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Failed"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type SetNetworkProfileResType = typeof SetNetworkProfileResSchema;

class SetNetworkProfileOcppIncoming extends OcppIncoming<
  SetNetworkProfileReqType,
  SetNetworkProfileResType
> {
  reqHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<SetNetworkProfileReqType>>,
  ): Promise<void> => {
    vcp.respond(this.response(call, { status: "Accepted" }));
  };
}

export const setNetworkProfileOcppIncoming = new SetNetworkProfileOcppIncoming(
  "SetNetworkProfile",
  SetNetworkProfileReqSchema,
  SetNetworkProfileResSchema,
);
