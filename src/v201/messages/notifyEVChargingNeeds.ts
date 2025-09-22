import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { StatusInfoTypeSchema } from "./_common";

const NotifyEVChargingNeedsReqSchema = z.object({
  maxScheduleTuples: z.number().int().nullish(),
  evseId: z.number().int(),
  chargingNeeds: z.object({
    requestedEnergyTransfer: z.enum([
      "DC",
      "AC_single_phase",
      "AC_two_phase",
      "AC_three_phase",
    ]),
    departureTime: z.string().datetime().nullish(),
    acChargingParameters: z
      .object({
        energyAmount: z.number().int(),
        evMinCurrent: z.number().int(),
        evMaxCurrent: z.number().int(),
        evMaxVoltage: z.number().int(),
      })
      .nullish(),
    dcChargingParameters: z
      .object({
        evMaxCurrent: z.number().int(),
        evMaxVoltage: z.number().int(),
        energyAmount: z.number().int().nullish(),
        evMaxPower: z.number().int().nullish(),
        stateOfCharge: z.number().int().min(0).max(100).nullish(),
        evEnergyCapacity: z.number().int().nullish(),
        fullSoC: z.number().int().min(0).max(100).nullish(),
        bulkSoC: z.number().int().min(0).max(100).nullish(),
      })
      .nullish(),
  }),
});
type NotifyEVChargingNeedsReqType = typeof NotifyEVChargingNeedsReqSchema;

const NotifyEVChargingNeedsResSchema = z.object({
  status: z.enum(["Accepted", "Rejected", "Processing"]),
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
