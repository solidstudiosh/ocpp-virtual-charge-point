import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import { resolveTokenPlaceholder } from "../../tokenPlaceholder";
import type { VCP } from "../../vcp";
import {
  EVSETypeSchema,
  IdTokenInfoTypeSchema,
  IdTokenTypeSchema,
  MessageContentTypeSchema,
  MeterValueTypeSchema,
} from "./_common";

const TransactionEventReqSchema = z.object({
  eventType: z.enum(["Started", "Updated", "Ended"]),
  timestamp: z.string().datetime(),
  triggerReason: z.enum([
    "Authorized",
    "CablePluggedIn",
    "ChargingRateChanged",
    "ChargingStateChanged",
    "Deauthorized",
    "EnergyLimitReached",
    "EVCommunicationLost",
    "EVConnectTimeout",
    "MeterValueClock",
    "MeterValuePeriodic",
    "TimeLimitReached",
    "Trigger",
    "UnlockCommand",
    "StopAuthorized",
    "EVDeparted",
    "EVDetected",
    "RemoteStop",
    "RemoteStart",
    "AbnormalCondition",
    "SignedDataReceived",
    "ResetCommand",
  ]),
  seqNo: z.number().int(),
  offline: z.boolean().nullish(),
  numberOfPhasesUsed: z.number().int().nullish(),
  cableMaxCurrent: z.number().int().nullish(),
  reservationId: z.number().int().nullish(),
  transactionInfo: z.object({
    transactionId: z.string().max(36),
    chargingState: z
      .enum(["Charging", "EVConnected", "SuspendedEV", "SuspendedEVSE", "Idle"])
      .nullish(),
    timeSpentCharging: z.number().int().nullish(),
    stoppedReason: z
      .enum([
        "DeAuthorized",
        "EmergencyStop",
        "EnergyLimitReached",
        "EVDisconnected",
        "GroundFault",
        "ImmediateReset",
        "Local",
        "LocalOutOfCredit",
        "MasterPass",
        "Other",
        "OvercurrentFault",
        "PowerLoss",
        "PowerQuality",
        "Reboot",
        "Remote",
        "SOCLimitReached",
        "StoppedByEV",
        "TimeLimitReached",
        "Timeout",
      ])
      .nullish(),
    remoteStartId: z.number().int().nullish(),
  }),
  idToken: IdTokenTypeSchema.nullish(),
  evse: EVSETypeSchema.nullish(),
  meterValue: z.array(MeterValueTypeSchema).nullish(),
});
type TransactionEventReqType = typeof TransactionEventReqSchema;

const TransactionEventResSchema = z.object({
  totalCost: z.number().nullish(),
  chargingPriority: z.number().int().nullish(),
  idTokenInfo: IdTokenInfoTypeSchema.nullish(),
  updatedPersonalMessage: MessageContentTypeSchema.nullish(),
});
type TransactionEventResType = typeof TransactionEventResSchema;

class TransactionEventOcppOutgoing extends OcppOutgoing<
  TransactionEventReqType,
  TransactionEventResType
> {
  beforeSend = (
    vcp: VCP,
    payload: z.infer<TransactionEventReqType>,
  ): z.infer<TransactionEventReqType> => {
    let resolved = payload;
    if (resolved.idToken) {
      resolved = {
        ...resolved,
        idToken: {
          ...resolved.idToken,
          idToken: resolveTokenPlaceholder(resolved.idToken.idToken),
        },
      };
    }
    // Callers that cannot know the transactionId of the ongoing transaction
    // (e.g. admin commands) may send "0" as a placeholder when updating or
    // ending it - resolve it as long as there is exactly one transaction to
    // resolve it to. Not for "Started", which is what assigns the id.
    if (
      resolved.eventType !== "Started" &&
      resolved.transactionInfo?.transactionId === "0"
    ) {
      const transactionId = vcp.transactionManager.onlyTransactionId();
      if (transactionId !== undefined) {
        resolved = {
          ...resolved,
          transactionInfo: {
            ...resolved.transactionInfo,
            transactionId: String(transactionId),
          },
        };
      }
    }
    return resolved;
  };

  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<TransactionEventReqType>>,
    _result: OcppCallResult<z.infer<TransactionEventResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const transactionEventOcppOutgoing = new TransactionEventOcppOutgoing(
  "TransactionEvent",
  TransactionEventReqSchema,
  TransactionEventResSchema,
);
