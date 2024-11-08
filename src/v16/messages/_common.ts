import { z } from "zod";

export const ConnectorIdSchema = z.number().int().nonnegative();

export const IdTokenSchema = z.string().max(36);

export const IdTagInfoSchema = z.object({
  expiryDate: z.string().datetime().nullish(),
  parentIdTag: IdTokenSchema.nullish(),
  status: z.enum(["Accepted", "Blocked", "Expired", "Invalid", "ConcurrentTx"]),
});

export const ChargingScheduleSchema = z.object({
  duration: z.number().int().nullish(),
  startSchedule: z.string().datetime().nullish(),
  chargingRateUnit: z.enum(["A", "W"]),
  chargingSchedulePeriod: z
    .array(
      z.object({
        startPeriod: z.number().int(),
        limit: z.number().multipleOf(0.1),
        numberPhases: z.number().int().nullish(),
      }),
    )
    .nonempty(),
  minChargingRate: z.number().multipleOf(0.1).nullish(),
});

export const ChargingProfileSchema = z
  .object({
    chargingProfileId: z.number().int(),
    transactionId: z.number().int().nullish(),
    stackLevel: z.number().int().nonnegative(),
    chargingProfilePurpose: z.enum([
      "ChargePointMaxProfile",
      "TxDefaultProfile",
      "TxProfile",
    ]),
    chargingProfileKind: z.enum(["Absolute", "Recurring", "Relative"]),
    recurrencyKind: z.enum(["Daily", "Weekly"]).nullish(),
    validFrom: z.string().datetime().nullish(),
    validTo: z.string().datetime().nullish(),
    chargingSchedule: ChargingScheduleSchema,
  })
  .superRefine((data, ctx) => {
    if (data.chargingProfilePurpose === "TxProfile" && !data.transactionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "transactionId is required when chargingProfilePurpose is 'TxProfile'",
        path: ["transactionId"],
      });
    }
  });

export const MeterValueSchema = z.object({
  timestamp: z.string().datetime(),
  sampledValue: z
    .array(
      z.object({
        value: z.string(),
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
        format: z.enum(["Raw", "SignedData"]).nullish(),
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
            "Energy.Reactive.Export.Interval",
            "Energy.Reactive.Import.Interval",
            "Frequency",
            "Power.Active.Export",
            "Power.Active.Import",
            "Power.Factor",
            "Power.Offered",
            "Power.Reactive.Export",
            "Power.Reactive.Import",
            "RPM",
            "SoC",
            "Temperature",
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
        location: z.enum(["Body", "Cable", "EV", "Inlet", "Outlet"]).nullish(),
        unit: z
          .enum([
            "Wh",
            "kWh",
            "varh",
            "kvarh",
            "W",
            "kW",
            "VA",
            "kVA",
            "var",
            "kvar",
            "A",
            "V",
            "Celsius",
            "Fahrenheit",
            "K",
            "Percent",
          ])
          .nullish(),
      }),
    )
    .nonempty(),
});
