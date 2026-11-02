import { z } from "zod";

// OCPP 1.2 types (spec §7). The WSDL has no length facets (only the spec tables do),
// so string lengths are the spec's.

export const ConnectorIdSchema = z.number().int().nonnegative();

export const IdTagSchema = z.string().max(15);

export const DateTimeSchema = z.string().datetime({ offset: true });

export const IdTagInfoSchema = z.object({
  status: z.enum(["Accepted", "Blocked", "Expired", "Invalid", "ConcurrentTx"]),
  expiryDate: DateTimeSchema.nullish(),
  parentIdTag: IdTagSchema.nullish(),
});

export const MeterValueSchema = z.object({
  timestamp: DateTimeSchema,
  /** Wh */
  value: z.number().int(),
});

export const ChargePointStatusSchema = z.enum([
  "Available",
  "Occupied",
  "Faulted",
  "Unavailable",
]);
