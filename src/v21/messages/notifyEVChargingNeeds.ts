import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import {
  DERControlType,
  EnergyTransferMode,
  StatusInfoTypeSchema,
} from "./_common";

const NotifyEVChargingNeedsReqSchema = z.object({
  evseId: z.number().int(),
  maxScheduleTuples: z.number().int().nullish(),
  timestamp: z.string().datetime(),
  chargingNeeds: z.object({
    requestedEnergyTransfer: EnergyTransferMode,
    availableEnergyTransfer: z.array(EnergyTransferMode).nullish(),
    controlMode: z.enum(["ScheduledControl", "DynamicControl"]).nullish(),
    mobilityNeedsMode: z.enum(["EVCC", "EVCC_SECC"]).nullish(),
    departureTime: z.string().datetime().nullish(),
    v2xChargingParameters: z
      .object({
        minChargePower: z.number().nullish(),
        minChargePower_L2: z.number().nullish(),
        minChargePower_L3: z.number().nullish(),
        maxChargePower: z.number().nullish(),
        maxChargePower_L2: z.number().nullish(),
        maxChargePower_L3: z.number().nullish(),
        minDischargePower: z.number().nullish(),
        minDischargePower_L2: z.number().nullish(),
        minDischargePower_L3: z.number().nullish(),
        maxDischargePower: z.number().nullish(),
        maxDischargePower_L2: z.number().nullish(),
        maxDischargePower_L3: z.number().nullish(),
        minChargeCurrent: z.number().nullish(),
        maxChargeCurrent: z.number().nullish(),
        minDischargeCurrent: z.number().nullish(),
        maxDischargeCurrent: z.number().nullish(),
        minVoltage: z.number().nullish(),
        maxVoltage: z.number().nullish(),
        evTargetEnergyRequest: z.number().nullish(),
        evMinEnergyRequest: z.number().nullish(),
        evMaxEnergyRequest: z.number().nullish(),
        evMinV2XEnergyRequest: z.number().nullish(),
        evMaxV2XEnergyRequest: z.number().nullish(),
        targetSoC: z.number().int().min(0).max(100).nullish(),
      })
      .nullish(),
    dcChargingParameters: z
      .object({
        evMaxCurrent: z.number().int(),
        evMaxVoltage: z.number().int(),
        evMaxPower: z.number().int().nullish(),
        evEnergyCapacity: z.number().int().nullish(),
        energyAmount: z.number().int().nullish(),
        stateOfCharge: z.number().int().min(0).max(100).nullish(),
        fullSoC: z.number().int().min(0).max(100).nullish(),
        bulkSoC: z.number().int().min(0).max(100).nullish(),
      })
      .nullish(),
    acChargingParameters: z
      .object({
        energyAmount: z.number().int(),
        evMinCurrent: z.number().int(),
        evMaxCurrent: z.number().int(),
        evMaxVoltage: z.number().int(),
      })
      .nullish(),
    evEnergyOffer: z
      .object({
        evPowerSchedule: z.object({
          timeAnchor: z.string().datetime(),
          evPowerScheduleEntries: z
            .array(
              z.object({
                duration: z.number().int(),
                power: z.number(),
              }),
            )
            .max(1024),
        }),
        evAbsolutePriceSchedule: z
          .object({
            timeAnchor: z.string().datetime(),
            currency: z.string().max(3),
            priceAlgorithm: z.string().max(2000),
            evAbsolutePriceScheduleEntries: z
              .array(
                z.object({
                  duration: z.number().int(),
                  evPriceRule: z
                    .array(
                      z.object({
                        energyFee: z.number(),
                        powerRangeStart: z.number(),
                      }),
                    )
                    .max(8),
                }),
              )
              .max(1024),
          })
          .nullish(),
      })
      .nullish(),
    derChargingParameters: z
      .object({
        evSupportedDERControl: z.array(DERControlType).nullish(),
        evOverExcitedMaxDischargePower: z.number().nullish(),
        evOverExcitedPowerFactor: z.number().nullish(),
        evUnderExcitedMaxDischargePower: z.number().nullish(),
        evUnderExcitedPowerFactor: z.number().nullish(),
        maxApparentPower: z.number().nullish(),
        maxChargeApparentPower: z.number().nullish(),
        maxChargeApparentPower_L2: z.number().nullish(),
        maxChargeApparentPower_L3: z.number().nullish(),
        maxDischargeApparentPower: z.number().nullish(),
        maxDischargeApparentPower_L2: z.number().nullish(),
        maxDischargeApparentPower_L3: z.number().nullish(),
        maxChargeReactivePower: z.number().nullish(),
        maxChargeReactivePower_L2: z.number().nullish(),
        maxChargeReactivePower_L3: z.number().nullish(),
        minChargeReactivePower: z.number().nullish(),
        minChargeReactivePower_L2: z.number().nullish(),
        minChargeReactivePower_L3: z.number().nullish(),
        maxDischargeReactivePower: z.number().nullish(),
        maxDischargeReactivePower_L2: z.number().nullish(),
        maxDischargeReactivePower_L3: z.number().nullish(),
        minDischargeReactivePower: z.number().nullish(),
        minDischargeReactivePower_L2: z.number().nullish(),
        minDischargeReactivePower_L3: z.number().nullish(),
        nominalVoltage: z.number().nullish(),
        nominalVoltageOffset: z.number().nullish(),
        maxNominalVoltage: z.number().nullish(),
        minNominalVoltage: z.number().nullish(),
        evInverterManufacturer: z.string().max(50).nullish(),
        evInverterModel: z.string().max(50).nullish(),
        evInverterSerialNumber: z.string().max(50).nullish(),
        evInverterSwVersion: z.string().max(50).nullish(),
        evInverterHwVersion: z.string().max(50).nullish(),
        evIslandingDetectionMethod: z
          .array(
            z.enum([
              "NoAntiIslandingSupport",
              "RoCoF",
              "UVP_OVP",
              "UFP_OFP",
              "VoltageVectorShift",
              "ZeroCrossingDetection",
              "OtherPassive",
              "ImpedanceMeasurement",
              "ImpedanceAtFrequency",
              "SlipModeFrequencyShift",
              "SandiaFrequencyShift",
              "SandiaVoltageShift",
              "FrequencyJump",
              "RCLQFactor",
              "OtherActive",
            ]),
          )
          .nullish(),
        evIslandingTripTime: z.number().nullish(),
        evMaximumLevel1DCInjection: z.number().nullish(),
        evDurationLevel1DCInjection: z.number().nullish(),
        evMaximumLevel2DCInjection: z.number().nullish(),
        evDurationLevel2DCInjection: z.number().nullish(),
        evReactiveSusceptance: z.number().nullish(),
        evSessionTotalDischargeEnergyAvailable: z.number().nullish(),
      })
      .nullish(),
  }),
});
type NotifyEVChargingNeedsReqType = typeof NotifyEVChargingNeedsReqSchema;

const NotifyEVChargingNeedsResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Processing", "NoChargingProfile"]),
  statusInfo: StatusInfoTypeSchema.nullish(),
});
type NotifyEVChargingNeedsResType = typeof NotifyEVChargingNeedsResSchema;

class NotifyEVChargingNeedsOcppOutgoing extends OcppOutgoing<
  NotifyEVChargingNeedsReqType,
  NotifyEVChargingNeedsResType
> {
  resHandler = async (
    _vcp: VCP,
    _call: OcppCall<z.infer<NotifyEVChargingNeedsReqType>>,
    _result: OcppCallResult<z.infer<NotifyEVChargingNeedsResType>>,
  ): Promise<void> => {
    // NOOP
  };
}

export const notifyEVChargingNeedsOcppOutgoing =
  new NotifyEVChargingNeedsOcppOutgoing(
    "NotifyEVChargingNeeds",
    NotifyEVChargingNeedsReqSchema,
    NotifyEVChargingNeedsResSchema,
  );
