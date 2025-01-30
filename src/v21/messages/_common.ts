import { z } from "zod";

export const EVSETypeSchema = z.object({
  id: z.number().int().nonnegative(),
  connectorId: z.number().int().nonnegative().nullish(),
});

export const AdditionalInfoTypeSchema = z.object({
  additionalIdToken: z.string().max(255),
  type: z.string().max(50),
});

export const MessageContentTypeSchema = z.object({
  format: z.enum(["ASCII", "HTML", "URI", "UTF8", "QRCODE"]),
  language: z.string().max(8).nullish(),
  content: z.string().max(1024),
});

export const StatusInfoTypeSchema = z.object({
  reasonCode: z.string().max(20),
  additionalInfo: z.string().max(1024).nullish(),
});

export const IdTokenTypeSchema = z.object({
  idToken: z.string().max(255),
  type: z.enum([
    "Central",
    "DirectPayment",
    "eMAID",
    "EVCCID",
    "ISO14443",
    "ISO15693",
    "KeyCode",
    "Local",
    "MacAddress",
    "NoAuthorization",
    "VIN",
  ]),
  additionalInfo: z.array(AdditionalInfoTypeSchema).nullish(),
});

export const IdTokenInfoTypeSchema = z.object({
  status: z.enum([
    "Accepted",
    "Blocked",
    "ConcurrentTx",
    "Expired",
    "Invalid",
    "NoCredit",
    "NotAllowedTypeEVSE",
    "NotAtThisLocation",
    "NotAtThisTime",
    "Unknown",
  ]),
  cacheExpiryDateTime: z.string().datetime().nullish(),
  chargingPriority: z.number().int().min(-9).max(9).default(0).nullish(),
  language1: z.string().max(8).nullish(),
  language2: z.string().max(8).nullish(),
  evseId: z.array(z.number().int()).nullish(),
  groupIdToken: IdTokenTypeSchema.nullish(),
  personalMessage: MessageContentTypeSchema.nullish(),
});

export const MeterValueTypeSchema = z.object({
  timestamp: z.string().datetime(),
  sampledValue: z
    .array(
      z.object({
        value: z.number(),
        context: z
          .enum([
            "Interruption.Begin",
            "Interruption.End",
            "Other",
            "Sample.Clock",
            "Sample.Periodic",
            "Transaction.Begin",
            "Transaction.End",
            "Trigger",
          ])
          .nullish(),
        measurand: z
          .enum([
            "Current.Export",
            "Current.Export.Offered",
            "Current.Export.Minimum",
            "Current.Import",
            "Current.Import.Offered",
            "Current.Import.Minimum",
            "Current.Offered",
            "Display.PresentSOC",
            "Display.MinimumSOC",
            "Display.TargetSOC",
            "Display.MaximumSOC",
            "Display.RemainingTimeToMinimumSOC",
            "Display.RemainingTimeToTargetSOC",
            "Display.RemainingTimeToMaximumSOC",
            "Display.ChargingComplete",
            "Display.BatteryEnergyCapacity",
            "Display.InletHot",
            "Energy.Active.Export.Interval",
            "Energy.Active.Export.Register",
            "Energy.Active.Import.Interval",
            "Energy.Active.Import.Register",
            "Energy.Active.Import.CableLoss",
            "Energy.Active.Import.LocalGeneration.Register",
            "Energy.Active.Net",
            "Energy.Active.Setpoint.Interval",
            "Energy.Apparent.Export",
            "Energy.Apparent.Import",
            "Energy.Apparent.Net",
            "Energy.Reactive.Export.Interval",
            "Energy.Reactive.Export.Register",
            "Energy.Reactive.Import.Register",
            "Energy.Reactive.Import.Interval",
            "Energy.Reactive.Net",
            "EnergyRequest.Target",
            "EnergyRequest.Minimum",
            "EnergyRequest.Maximum",
            "EnergyRequest.Minimum.V2X",
            "EnergyRequest.Maximum.V2X",
            "EnergyRequest.Bulk",
            "Frequency",
            "Power.Active.Export",
            "Power.Active.Import",
            "Power.Active.Setpoint",
            "Power.Active.Residual",
            "Power.Export.Minimum",
            "Power.Export.Offered",
            "Power.Factor",
            "Power.Import.Offered",
            "Power.Import.Minimum",
            "Power.Offered",
            "Power.Reactive.Export",
            "Power.Reactive.Import",
            "SoC",
            "Voltage",
            "Voltage.Minimum",
            "Voltage.Maximum",
          ])
          .nullish(),
        phase: z
          .enum([
            "L1",
            "L2",
            "L3",
            "N",
            "L1-N",
            "L2-N",
            "L3-N",
            "L1-L2",
            "L2-L3",
            "L3-L1",
          ])
          .nullish(),
        location: z
          .enum(["Body", "Cable", "EV", "Inlet", "Outlet", "Upstream"])
          .nullish(),
        signedMeterValue: z
          .object({
            signedMeterData: z.string().max(32768),
            signingMethod: z.string().max(50).nullish(),
            encodingMethod: z.string().max(50),
            publicKey: z.string().max(2500).nullish(),
          })
          .nullish(),
        unitOfMeasure: z
          .object({
            unit: z.string().max(20).nullish(),
            multiplier: z.number().int().nullish(),
          })
          .nullish(),
      }),
    )
    .nonempty(),
});

export const CertificateHashDataTypeSchema = z.object({
  hashAlgorithm: z.enum(["SHA256", "SHA384", "SHA512"]),
  issuerNameHash: z.string().max(128),
  issuerKeyHash: z.string().max(128),
  serialNumber: z.string().max(40),
});

export const OCSPRequestDataTypeSchema = z.object({
  hashAlgorithm: z.enum(["SHA256", "SHA384", "SHA512"]),
  issuerNameHash: z.string().max(128),
  issuerKeyHash: z.string().max(128),
  serialNumber: z.string().max(40),
  responderURL: z.string().max(2000),
});

export const ComponentTypeSchema = z.object({
  name: z.string().max(50),
  instance: z.string().max(50).nullish(),
  evse: EVSETypeSchema.nullish(),
});

export const VariableTypeSchema = z.object({
  name: z.string().max(50),
  instance: z.string().max(50).nullish(),
});

export const GenericStatusEnumSchema = z.enum(["Accepted", "Rejected"]);

export const MessageInfoSchema = z.object({
  id: z.number().int(),
  priority: z.enum(["AlwaysFront", "InFront", "NormalCycle"]),
  state: z.enum([
    "Charging",
    "Faulted",
    "Idle",
    "Unavailable",
    "Suspended",
    "Discharging",
  ]),
  startDateTime: z.string().datetime().nullish(),
  endDateTime: z.string().datetime().nullish(),
  transactionId: z.string().nullish(),
  message: MessageContentTypeSchema,
  display: ComponentTypeSchema.nullish(),
  messageExtra: z.array(MessageContentTypeSchema).max(4).nullish(),
});

export const ChargingProfilePurposeSchema = z.enum([
  "ChargingStationExternalConstraints",
  "ChargingStationMaxProfile",
  "TxDefaultProfile",
  "TxProfile",
  "PriorityCharging",
  "LocalGeneration",
]);

export const ChargingProfileSchema = z.object({
  id: z.number().int(),
  stackLevel: z.number().int().nonnegative(),
  chargingProfilePurpose: ChargingProfilePurposeSchema,
  chargingProfileKind: z.enum(["Absolute", "Recurring", "Relative"]),
  recurrencyKind: z.enum(["Daily", "Weekly"]).nullish(),
  validFrom: z.string().datetime().nullish(),
  validTo: z.string().datetime().nullish(),
  transactionId: z.string().max(36).nullish(),
  chargingSchedule: z.array(
    z.object({
      id: z.number().int(),
      startSchedule: z.string().datetime().nullish(),
      duration: z.number().int().nullish(),
      chargingRateUnit: z.enum(["A", "W"]),
      minChargingRate: z.number().nullish(),
      chargingSchedulePeriod: z
        .array(
          z.object({
            startPeriod: z.number().int(),
            limit: z.number(),
            numberPhases: z.number().int().nullish(),
            phaseToUse: z.number().int().nullish(),
          }),
        )
        .nonempty(),
      salesTariff: z
        .object({
          id: z.number().int(),
          salesTariffDescription: z.string().max(32),
          numEPriceLevels: z.number().int().nullish(),
          salesTariffEntry: z.array(
            z.object({
              ePriceLevel: z.number().int().nullish(),
              relativeTimeInterval: z.object({
                start: z.number().int(),
                duration: z.number().int().nullish(),
              }),
              consumptionCost: z.array(
                z.object({
                  startValue: z.number(),
                  cost: z.array(
                    z.object({
                      costKind: z.enum([
                        "CarbonDioxideEmission",
                        "RelativePricePercentage",
                        "RenewableGenerationPercentage",
                      ]),
                      amount: z.number().int(),
                      amountMultiplier: z.number().int().nullish(),
                    }),
                  ),
                }),
              ),
            }),
          ),
        })
        .nullish(),
    }),
  ),
});

export const MonitorTypeSchema = z.enum([
  "UpperThreshold",
  "LowerThreshold",
  "Delta",
  "Periodic",
  "PeriodicClockAligned",
  "TargetDelta",
  "TargetDeltaRelative",
]);

export const PeriodicEventStreamParams = z.object({
  interval: z.number().int().nonnegative(),
  values: z.number().int().nonnegative(),
});

export const EnergyTransferMode = z.enum([
  "AC_single_phase",
  "AC_two_phase",
  "AC_three_phase",
  "DC",
  "AC_BPT",
  "AC_BPT_DER",
  "AC_DER",
  "DC_BPT",
  "DC_ACDP",
  "DC_ACDP_BPT",
  "WPT",
]);

const TaxRate = z.object({
  type: z.string().max(20),
  tax: z.number(),
  stack: z.number().int().nonnegative().nullish(),
});

const TariffConditions = z.object({
  startTimeOfDay: z
    .string()
    .regex(/([0-1][0-9]|2[0-3]):[0-5][0-9]/)
    .nullish(),
  endTimeOfDay: z
    .string()
    .regex(/([0-1][0-9]|2[0-3]):[0-5][0-9]/)
    .nullish(),
  dayOfWeek: z
    .array(
      z.enum([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]),
    )
    .nullish(),
  validFromDate: z
    .string()
    .regex(/([12][0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])/)
    .nullish(),
  validToDate: z
    .string()
    .regex(/([12][0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])/)
    .nullish(),
  evseKind: z.enum(["AC", "DC"]).nullish(),
  minEnergy: z.number().nullish(),
  maxEnergy: z.number().nullish(),
  minCurrent: z.number().nullish(),
  maxCurrent: z.number().nullish(),
  minPower: z.number().nullish(),
  maxPower: z.number().nullish(),
  minTime: z.number().int().nullish(),
  maxTime: z.number().int().nullish(),
  minChargingTime: z.number().int().nullish(),
  maxChargingTime: z.number().int().nullish(),
  minIdleTime: z.number().int().nullish(),
  maxIdleTime: z.number().int().nullish(),
});

const TariffEnergy = z.object({
  taxRates: z.array(TaxRate).max(5).nullish(),
  prices: z.array(
    z.object({
      priceKwh: z.number(),
      conditions: TariffConditions.nullish(),
    }),
  ),
});

const TariffTime = z.object({
  taxRates: z.array(TaxRate).max(5).nullish(),
  prices: z.array(
    z.object({
      priceMinute: z.number(),
      conditions: TariffConditions.nullish(),
    }),
  ),
});

const TariffFixed = z.object({
  taxRates: z.array(TaxRate).max(5).nullish(),
  prices: z.array(
    z.object({
      priceFixed: z.number(),
      conditions: TariffConditions.nullish(),
    }),
  ),
});

export const Price = z.object({
  exclTax: z.number().nullish(),
  inclTax: z.number().nullish(),
  taxRates: z.array(TaxRate).max(5).nullish(),
});

export const Tariff = z.object({
  tariffId: z.string().max(60),
  currency: z.string().max(3),
  validFrom: z.string().datetime().nullish(),
  description: z.array(MessageContentTypeSchema).nullish(),
  energy: TariffEnergy.nullish(),
  chargingTime: TariffTime.nullish(),
  idleTime: TariffTime.nullish(),
  fixedFee: TariffFixed.nullish(),
  minCost: Price.nullish(),
  maxCost: Price.nullish(),
  reservationTime: TariffTime.nullish(),
  reservationFixed: TariffFixed.nullish(),
});

export const DERControlType = z.enum([
  "EnterService",
  "FreqDroop",
  "FreqWatt",
  "FixedPFAbsorb",
  "FixedPFInject",
  "FixedVar",
  "Gradients",
  "HFMustTrip",
  "HFMayTrip",
  "HVMustTrip",
  "HVMomCess",
  "HVMayTrip",
  "LimitMaxDischarge",
  "LFMustTrip",
  "LVMustTrip",
  "LVMomCess",
  "LVMayTrip",
  "PowerMonitoringMustTrip",
  "VoltVar",
  "VoltWatt",
  "WattPF",
  "WattVar",
]);

export const RationalNumberType = z.object({
  exponent: z.number().int(),
  value: z.number().int(),
});

export const ChargingScheduleSchema = z.object({
  id: z.number().int(),
  startSchedule: z.string().datetime().nullish(),
  duration: z.number().int().nullish(),
  chargingRateUnit: z.enum(["W", "A"]),
  minChargingRate: z.number().nullish(),
  powerTolerance: z.number().nullish(),
  signatureId: z.number().int().nullish(),
  digestValue: z.string().max(88).nullish(),
  useLocalTime: z.boolean().nullish(),
  randomizedDelay: z.number().int().nullish(),
  salesTariff: z
    .object({
      id: z.number().int(),
      salesTariffDescription: z.string().max(32).nullish(),
      numEPriceLevels: z.number().int().nullish(),
      salesTariffEntry: z
        .array(
          z.object({
            ePriceLevel: z.number().int().nullish(),
            relativeTimeInterval: z.object({
              start: z.number().int(),
              duration: z.number().int().nullish(),
            }),
            consumptionCost: z
              .array(
                z.object({
                  startValue: z.number(),
                  cost: z
                    .array(
                      z.object({
                        costKind: z.enum([
                          "CarbonDioxideEmission",
                          "RelativePricePercentage",
                          "RenewableGenerationPercentage",
                        ]),
                        amount: z.number().int(),
                        amountMultiplier: z
                          .number()
                          .int()
                          .min(-3)
                          .max(3)
                          .nullish(),
                      }),
                    )
                    .max(3),
                }),
              )
              .max(3)
              .nullish(),
          }),
        )
        .max(1024),
    })
    .nullish(),
  chargingSchedulePeriod: z
    .array(
      z.object({
        startPeriod: z.number().int(),
        limit: z.number().nullish(),
        limit_L2: z.number().nullish(),
        limit_L3: z.number().nullish(),
        numberPhases: z.number().int().min(0).max(3).nullish(),
        phaseToUse: z.number().int().min(0).max(3).nullish(),
        dischargeLimit: z.number().nullish(),
        dischargeLimit_L2: z.number().nullish(),
        dischargeLimit_L3: z.number().nullish(),
        setpoint: z.number().nullish(),
        setpoint_L2: z.number().nullish(),
        setpoint_L3: z.number().nullish(),
        setpointReactive: z.number().nullish(),
        setpointReactive_L2: z.number().nullish(),
        setpointReactive_L3: z.number().nullish(),
        preconditioningRequest: z.boolean().nullish(),
        evseSleep: z.boolean().nullish(),
        v2xBaseline: z.number().nullish(),
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
        v2xFreqWattCurve: z
          .array(z.object({ frequency: z.number(), power: z.number() }))
          .max(20)
          .nullish(),
        v2xSignalWattCurve: z
          .array(z.object({ signal: z.number(), power: z.number() }))
          .max(20)
          .nullish(),
      }),
    )
    .max(1024),
  absolutePriceSchedule: z
    .object({
      timeAnchor: z.string().datetime(),
      priceScheduleID: z.number().int(),
      priceScheduleDescription: z.string().max(160).nullish(),
      currency: z.string().max(3),
      language: z.string().max(8),
      priceAlgorithm: z.string().max(2000),
      priceRuleStacks: z
        .array(
          z.object({
            duration: z.number().int(),
            priceRule: z
              .array(
                z.object({
                  parkingFeePeriod: z.number().int().nullish(),
                  carbonDioxideEmission: z.number().int().nullish(),
                  renewableGenerationPercentage: z
                    .number()
                    .int()
                    .min(0)
                    .max(100)
                    .nullish(),
                  energyFee: RationalNumberType,
                  parkingFee: RationalNumberType.nullish(),
                  powerRangeStart: RationalNumberType,
                }),
              )
              .max(8)
              .nonempty(),
          }),
        )
        .max(1024),
      taxRules: z
        .array(
          z.object({
            taxRuleID: z.number().int(),
            taxRuleName: z.string().max(100).nullish(),
            taxIncludedInPrice: z.boolean().nullish(),
            appliesToEnergyFee: z.boolean(),
            appliesToParkingFee: z.boolean(),
            appliesToOverstayFee: z.boolean(),
            appliesToMinimumMaximumCost: z.boolean(),
            taxRate: RationalNumberType,
          }),
        )
        .max(10)
        .nullish(),
      additionalSelectedServices: z
        .array(
          z.object({
            serviceName: z.string().max(80),
            serviceFee: RationalNumberType,
          }),
        )
        .max(5)
        .nullish(),
      overstayRuleList: z
        .object({
          overstayTimeThreshold: z.number().int().nullish(),
          overstayPowerThreshold: RationalNumberType,
          overstayRule: z
            .array(
              z.object({
                overstayRuleDescription: z.string().max(32).nullish(),
                startTime: z.number().int(),
                overstayFeePeriod: z.number().int(),
                overstayFee: RationalNumberType,
              }),
            )
            .max(5)
            .nonempty(),
        })
        .nullish(),
      minimumCost: RationalNumberType.nullish(),
      maximumCost: RationalNumberType.nullish(),
    })
    .nullish(),
  priceLevelSchedule: z
    .object({
      timeAnchor: z.string().datetime(),
      priceScheduleId: z.number().int(),
      priceScheduleDescription: z.string().max(32).nullish(),
      numberOfPriceLevels: z.number().int(),
      priceLevelScheduleEntries: z
        .array(
          z.object({
            duration: z.number().int(),
            priceLevel: z.number().int(),
          }),
        )
        .max(100)
        .nonempty(),
    })
    .nullish(),
  limitAtSoC: z
    .object({
      soc: z.number().int().min(0).max(100),
      limit: z.number(),
    })
    .nullish(),
});

export const FixedPF = z.object({
  priority: z.number().int(),
  displacement: z.number(),
  excitation: z.boolean(),
  startTime: z.string().datetime().nullish(),
  duration: z.number().nullish(),
});

export const FixedVar = z.object({
  priority: z.number().int(),
  setpoint: z.number(),
  unit: z.enum([
    "Not_Applicable",
    "PctMaxW",
    "PctMaxVar",
    "PctWAvail",
    "PctVarAvail",
    "PctEffectiveV",
  ]),
  startTime: z.string().datetime().nullish(),
  duration: z.number().nullish(),
});

export const DERCurve = z.object({
  priority: z.number().int(),
  yUnit: z.enum([
    "Not_Applicable",
    "PctMaxW",
    "PctMaxVar",
    "PctWAvail",
    "PctVarAvail",
    "PctEffectiveV",
  ]),
  responseTime: z.number().nullish(),
  startTime: z.string().datetime().nullish(),
  duration: z.number().nullish(),
  hysteresis: z
    .object({
      hysteresisHigh: z.number().nullish(),
      hysteresisLow: z.number().nullish(),
      hysteresisDelay: z.number().nullish(),
      hysteresisGradient: z.number().nullish(),
    })
    .nullish(),
  voltageParams: z
    .object({
      hv10MinMeanValue: z.number().nullish(),
      hv10MinMeanTripDelay: z.number().nullish(),
      powerDuringCessation: z.enum(["Active", "Reactive"]).nullish(),
    })
    .nullish(),
  reactivePowerParams: z
    .object({
      vRef: z.number().nullish(),
      autonomousVRefEnable: z.boolean().nullish(),
      autonomousVRefTimeConstant: z.number().nullish(),
    })
    .nullish(),
  curveData: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
      }),
    )
    .max(10),
});

export const LimitMaxDischarge = z.object({
  priority: z.number().int(),
  pctMaxDischargePower: z.number().nullish(),
  startTime: z.string().datetime().nullish(),
  duration: z.number().nullish(),
  powerMonitoringMustTrip: DERCurve.nullish(),
});

export const FreqDroop = z.object({
  priority: z.number().int(),
  overFreq: z.number(),
  underFreq: z.number(),
  overDroop: z.number(),
  underDroop: z.number(),
  responseTime: z.number(),
  startTime: z.string().datetime().nullish(),
  duration: z.number().nullish(),
});

export const EnterService = z.object({
  priority: z.number().int(),
  highVoltage: z.number(),
  lowVoltage: z.number(),
  highFreq: z.number(),
  lowFreq: z.number(),
  delay: z.number().nullish(),
  randomDelay: z.number().nullish(),
  rampRate: z.number().nullish(),
});

export const Gradient = z.object({
  priority: z.number().int(),
  gradient: z.number(),
  softGradient: z.number(),
});

export const ChargingScheduleUpdate = z.object({
  limit: z.number().nullish(),
  limit_L2: z.number().nullish(),
  limit_L3: z.number().nullish(),
  dischargeLimit: z.number().nullish(),
  dischargeLimit_L2: z.number().nullish(),
  dischargeLimit_L3: z.number().nullish(),
  setpoint: z.number().nullish(),
  setpoint_L2: z.number().nullish(),
  setpoint_L3: z.number().nullish(),
  setpointReactive: z.number().nullish(),
  setpointReactive_L2: z.number().nullish(),
  setpointReactive_L3: z.number().nullish(),
});
