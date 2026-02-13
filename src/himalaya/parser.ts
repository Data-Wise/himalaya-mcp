/**
 * JSON response parser for himalaya CLI output.
 * Converts raw stdout strings into typed objects.
 */

import type {
  Envelope,
  Folder,
  Account,
  MessageBody,
  CommandOutput,
} from "./types.js";

/**
 * Parse a JSON response from himalaya, returning a typed result.
 * Handles empty responses, malformed JSON, and error strings.
 */
export function parse<T>(raw: string): CommandOutput<T> {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, error: "Empty response from himalaya", code: "EMPTY" };
  }

  try {
    const data = JSON.parse(trimmed) as T;
    return { ok: true, data };
  } catch {
    // himalaya might return an error string instead of JSON
    return {
      ok: false,
      error: `Failed to parse himalaya output: ${trimmed.slice(0, 200)}`,
      code: "PARSE_ERROR",
    };
  }
}

/** Parse envelope list response. */
export function parseEnvelopes(raw: string): CommandOutput<Envelope[]> {
  return parse<Envelope[]>(raw);
}

/** Parse folder list response. */
export function parseFolders(raw: string): CommandOutput<Folder[]> {
  return parse<Folder[]>(raw);
}

/** Parse account list response. */
export function parseAccounts(raw: string): CommandOutput<Account[]> {
  return parse<Account[]>(raw);
}

/**
 * Parse message body response.
 * himalaya returns the body as a JSON-quoted string.
 */
export function parseMessageBody(raw: string): CommandOutput<MessageBody> {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, error: "Empty message body", code: "EMPTY" };
  }

  // himalaya message read --output json returns a JSON string (quoted)
  // e.g., "Hello world\n\nThis is the body"
  try {
    const body = JSON.parse(trimmed) as string;
    return { ok: true, data: body };
  } catch {
    // If it's not valid JSON, it might be raw text (fallback)
    return { ok: true, data: trimmed };
  }
}
