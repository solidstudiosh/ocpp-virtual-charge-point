import { z } from "zod";

export const EVSETypeSchema = z.object({
  id: z.number().int().positive(),
  connectorId: z.number().int().positive().nullish(),
});

export const AdditionalInfoTypeSchema = z.object({
  additionalIdToken: z.string().max(36),
  type: z.string().max(50),
});

export const MessageContentTypeSchema = z.object({
  format: z.enum(["ASCII", "HTML", "URI", "UTF8"]),
  language: z.string().max(8).nullish(),
  content: z.string().max(512),
});

export const StatusInfoTypeSchema = z.object({
  reasonCode: z.string().max(20),
  additionalInfo: z.string().max(512).nullish(),
});

export const IdTokenTypeSchema = z.object({
  idToken: z.string().max(36),
  type: z.enum([
    "Central",
    "eMAID",
    "ISO14443",
    "ISO15693",
    "KeyCode",
    "Local",
    "MacAddress",
    "NoAuthorization",
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
  evseId: z.array(z.number().int()).nullish(),
  language2: z.string().max(8).nullish(),
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
            "Current.Import",
            "Current.Offered",
            "Energy.Active.Export.Register",
            "Energy.Active.Import.Register",
            "Energy.Reactive.Export.Register",
            "Energy.Reactive.Import.Register",
            "Energy.Active.Export.Interval",
            "Energy.Active.Import.Interval",
            "Energy.Active.Net",
            "Energy.Reactive.Export.Interval",
            "Energy.Reactive.Import.Interval",
            "Energy.Reactive.Net",
            "Energy.Apparent.Net",
            "Energy.Apparent.Import",
            "Energy.Apparent.Export",
            "Frequency",
            "Power.Active.Export",
            "Power.Active.Import",
            "Power.Factor",
            "Power.Offered",
            "Power.Reactive.Export",
            "Power.Reactive.Import",
            "SoC",
            "Voltage",
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
        location: z.enum(["Cable", "EV", "Inlet", "Outlet"]).nullish(),
        signedMeterValue: z
          .object({
            signedMeterData: z.string().max(2500),
            signingMethod: z.string().max(50),
            encodingMethod: z.string().max(50),
            publicKey: z.string().max(2500),
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
  responderURL: z.string().max(512),
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
  state: z.enum(["Charging", "Faulted", "Idle", "Unavailable"]),
  startDateTime: z.string().datetime().nullish(),
  endDateTime: z.string().datetime().nullish(),
  transactionId: z.string().nullish(),
  message: MessageContentTypeSchema,
  display: ComponentTypeSchema.nullish(),
});

export const ChargingProfilePurposeSchema = z.enum([
  "ChargingStationExternalConstraints",
  "ChargingStationMaxProfile",
  "TxDefaultProfile",
  "TxProfile",
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
]);
