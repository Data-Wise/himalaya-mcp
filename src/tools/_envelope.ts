/**
 * Shared helper for tool handlers: surface errors as structured MCP envelope responses.
 *
 * Tool handlers wrap their body with:
 *   try { ... } catch (err) { return envelopeError(err); }
 *
 * - {@link HimalayaError}: emits the carried structured envelope.
 * - Other Errors: wrapped as an "unknown" envelope so the response is still well-formed.
 *
 * Output is always `{ error: MCPError }` JSON in a single text content block,
 * with `isError: true`. Downstream tools (and tests) can parse the JSON and
 * assert on `envelope.code`.
 */

import { HimalayaError, type MCPError } from "../himalaya/errors.js";

export function envelopeError(err: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  let envelope: MCPError;
  if (err instanceof HimalayaError) {
    envelope = err.envelope;
  } else if (err instanceof Error) {
    envelope = {
      code: "unknown",
      message: err.message,
      recoverable: false,
    };
  } else {
    envelope = {
      code: "unknown",
      message: String(err),
      recoverable: false,
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: envelope }, null, 2),
      },
    ],
    isError: true,
  };
}
