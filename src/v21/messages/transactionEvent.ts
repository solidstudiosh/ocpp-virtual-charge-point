import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  EVSETypeSchema,
  IdTokenInfoTypeSchema,
  IdTokenTypeSchema,
  MessageContentTypeSchema,
  MeterValueTypeSchema,
  Price,
} from "./_common";

const TransactionEventReqSchema = z.object({
  eventType: z.enum(["Started", "Updated", "Ended"]),
  timestamp: z.string().datetime(),
  triggerReason: z.enum([
    "AbnormalCondition",
    "Authorized",
    "CablePluggedIn",
    "ChargingRateChanged",
    "ChargingStateChanged",
    "CostLimitReached",
    "Deauthorized",
    "EnergyLimitReached",
    "EVCommunicationLost",
    "EVConnectTimeout",
    "EVDeparted",
    "EVDetected",
    "LimitSet",
    "MeterValueClock",
    "MeterValuePeriodic",
    "OperationModeChanged",
    "RemoteStart",
    "RemoteStop",
    "ResetCommand",
    "RunningCost",
    "SignedDataReceived",
    "SoCLimitReached",
    "StopAuthorized",
    "TariffChanged",
    "TariffNotAccepted",
    "TimeLimitReached",
    "Trigger",
    "TxResumed",
    "UnlockCommand",
  ]),
  seqNo: z.number().int(),
  offline: z.boolean().nullish(),
  numberOfPhasesUsed: z.number().int().nullish(),
  cableMaxCurrent: z.number().int().nullish(),
  reservationId: z.number().int().nullish(),
  preconditioningStatus: z
    .enum(["Unknown", "Ready", "NotReady", "Preconditioning"])
    .nullish(),
  evseSleep: z.boolean().nullish(),
  meterValue: z.array(MeterValueTypeSchema).nullish(),
  idToken: IdTokenTypeSchema.nullish(),
  evse: EVSETypeSchema.nullish(),
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
        "MasterPass",
        "Local",
        "LocalOutOfCredit",
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
        "ReqEnergyTransferRejected",
      ])
      .nullish(),
    remoteStartId: z.number().int().nullish(),
    operationMode: z
      .enum([
        "Idle",
        "ChargingOnly",
        "CentralSetpoint",
        "ExternalSetpoint",
        "ExternalLimits",
        "CentralFrequency",
        "LocalFrequency",
        "LocalLoadBalancing",
      ])
      .nullish(),
    tariffId: z.string().max(60).nullish(),
    transactionLimit: z
      .object({
        maxCost: z.number().nullish(),
        maxEnergy: z.number().nullish(),
        maxTime: z.number().int().nullish(),
        maxSoC: z.number().int().min(0).max(100).nullish(),
      })
      .nullish(),
  }),
  costDetails: z
    .object({
      failureToCalculate: z.boolean().nullish(),
      failureReason: z.string().max(500).nullish(),
      chargingPeriods: z
        .array(
          z.object({
            tariffId: z.string().max(60).nullish(),
            startPeriod: z.string().datetime(),
            dimensions: z
              .array(
                z.object({
                  type: z.enum([
                    "Energy",
                    "MaxCurrent",
                    "MinCurrent",
                    "MaxPower",
                    "MinPower",
                    "IdleTime",
                    "ChargingTime",
                  ]),
                  volume: z.number(),
                }),
              )
              .nullish(),
          }),
        )
        .nullish(),
      totalCost: z.object({
        currency: z.string().max(3),
        typeOfCost: z.enum(["NormalCost", "MinCost", "MaxCost"]),
        fixed: Price.nullish(),
        energy: Price.nullish(),
        chargingTime: Price.nullish(),
        idleTime: Price.nullish(),
        reservationTime: Price.nullish(),
        total: z.object({
          exclTax: z.number().nullish(),
          inclTax: z.number().nullish(),
        }),
        reservationFixed: Price.nullish(),
      }),
      totalUsage: z.object({
        energy: z.number(),
        chargingTime: z.number().int(),
        idleTime: z.number().int(),
        reservationTime: z.number().int().nullish(),
      }),
    })
    .nullish(),
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
