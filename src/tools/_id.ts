import { z } from "zod";

/**
 * Message ID schema shared by all tools.
 *
 * list_emails reports numeric IDs, so clients may pass either a string or an
 * integer. Unlike `z.coerce.string()`, this rejects null, objects and floats
 * instead of turning them into "null" / "[object Object]" / "1.5" and sending
 * them to himalaya as bogus IDs.
 */
export function messageId(description = "Email message ID") {
  return z
    .union([z.string(), z.number().int().nonnegative()])
    .transform((v) => String(v))
    .describe(description);
}
