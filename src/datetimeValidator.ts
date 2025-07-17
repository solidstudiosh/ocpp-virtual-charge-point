import { z } from "zod";

/**
 * Flexible datetime validator that handles various datetime formats
 * including .NET-style datetime with up to 7 decimal places for fractional seconds
 * 
 * Supports formats like:
 * - 2025-07-17T15:26:37.588+00:00 (standard)
 * - 2025-07-17T15:26:37.5884567+00:00 (.NET with 7 decimals)
 * - 2025-07-17T15:26:37Z (UTC)
 * - 2025-07-17T15:26:37.123Z (milliseconds)
 */
export const flexibleDatetime = () => z.string().refine((val) => {
    if (!val) return true; // Allow null/undefined

    // Handle .NET-style datetime with up to 7 decimal places and various timezone formats
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?(Z|[+-]\d{2}:\d{2}|\+\d{2}:\d{2})$/;
    if (dateTimeRegex.test(val)) {
        // Try to parse it as a valid date
        const date = new Date(val);
        return !isNaN(date.getTime());
    }

    // Fall back to standard datetime validation
    try {
        z.string().datetime().parse(val);
        return true;
    } catch {
        return false;
    }
}, { message: "Invalid datetime format" });

/**
 * Nullable version of flexible datetime validator
 */
export const flexibleDatetimeNullish = () => flexibleDatetime().nullish();
