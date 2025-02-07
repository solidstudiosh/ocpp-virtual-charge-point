import { z } from "zod";
import { OcppCall, OcppCallResult, OcppMessage } from "../../ocppMessage";
import { VCP } from "../../vcp";
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

class TransactionEventOcppMessage extends OcppMessage<
  TransactionEventReqType,
  TransactionEventResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<TransactionEventReqType>>,
    _result: OcppCallResult<z.infer<TransactionEventResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const transactionEventOcppMessage = new TransactionEventOcppMessage(
  "TransactionEvent",
  TransactionEventReqSchema,
  TransactionEventResSchema,
);
