/**
 * JSON response parser for himalaya CLI output.
 * Converts raw stdout strings into typed objects.
 */

import type {
  Envelope,
  Folder,
  Account,
  Address,
  MessageBody,
  CommandOutput,
  V2Envelope,
  V2Address,
  V2Mailbox,
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

/**
 * Unwrap a himalaya v2 list wrapper object back into a bare array.
 *
 * himalaya v1 returns bare arrays (`[...]`), while v2 wraps them in a named
 * object (`{"mailboxes":[...]}`, `{"envelopes":[...]}`). Accepts either shape.
 */
export function unwrapList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data !== null && typeof data === "object") {
    const wrapped = (data as Record<string, unknown>)[key];
    if (Array.isArray(wrapped)) return wrapped as T[];
  }
  return [];
}

/** Map a v2 address (array of {name, email}) to the canonical single Address. */
function firstAddress(list: V2Address[]): Address {
  const first = list[0];
  return first ? { name: first.name, addr: first.email } : { name: null, addr: "" };
}

/** Normalize a v2 envelope object to the canonical v1 Envelope shape. */
function normalizeEnvelope(e: Envelope | V2Envelope): Envelope {
  // v2 `from`/`to` are arrays; v1's are single objects. Presence of an array
  // distinguishes the wire shapes.
  if (!Array.isArray(e.from)) return e as Envelope;
  // v2 branch: `from`/`to` are arrays, `flags` are {raw, iana} objects,
  // sizes are kebab-case `has-attachment` null|bool.
  const v2 = e as V2Envelope;
  return {
    id: v2.id,
    flags: v2.flags.map((f) => f.raw.replace(/^\\/, "")),
    subject: v2.subject,
    from: firstAddress(v2.from),
    to: firstAddress(v2.to),
    date: v2.date,
    has_attachment: Boolean(v2["has-attachment"]),
  };
}

/** Normalize a v2 mailbox object to the canonical Folder shape. */
function normalizeFolder(f: Folder | V2Mailbox): Folder {
  // v2 mailbox objects carry id/name/total/unread but no `desc`
  if ("desc" in f) return f;
  return { name: f.name, desc: "" };
}

/** Parse envelope list response (v1 bare array or v2 {"envelopes":[...]}). */
export function parseEnvelopes(raw: string): CommandOutput<Envelope[]> {
  const result = parse<unknown>(raw);
  if (!result.ok) return result;
  const list = unwrapList<Envelope | V2Envelope>(result.data, "envelopes");
  return { ok: true, data: list.map(normalizeEnvelope) };
}

/** Parse folder list response (v1 bare array or v2 {"mailboxes":[...]}). */
export function parseFolders(raw: string): CommandOutput<Folder[]> {
  const result = parse<unknown>(raw);
  if (!result.ok) return result;
  const list = unwrapList<Folder | V2Mailbox>(result.data, "mailboxes");
  return { ok: true, data: list.map(normalizeFolder) };
}

/** Parse account list response. */
export function parseAccounts(raw: string): CommandOutput<Account[]> {
  return parse<Account[]>(raw);
}

/** Format an envelope as a pipe-delimited line for LLM consumption. */
export function formatEnvelope(e: Envelope): string {
  const flags = e.flags.length > 0 ? ` [${e.flags.join(", ")}]` : "";
  const attachment = e.has_attachment ? " [attachment]" : "";
  return `${e.id} | ${e.date} | ${e.from.name || e.from.addr} | ${e.subject}${flags}${attachment}`;
}

/**
 * Parse a template response from `himalaya template reply --output json`.
 *
 * himalaya returns either a plain JSON string OR an object of the form
 * `{content: string, cursor: {row: number, col: number}}`.
 * Both forms are normalized to a plain string for downstream use.
 */
export function parseTemplate(raw: string): CommandOutput<string> {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { ok: false, error: "Empty template response", code: "EMPTY" };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (typeof parsed === "string") {
      return { ok: true, data: parsed };
    }

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "content" in parsed &&
      typeof (parsed as { content: unknown }).content === "string"
    ) {
      return { ok: true, data: (parsed as { content: string }).content };
    }

    // Unexpected shape — fall through to raw text
    return { ok: true, data: trimmed };
  } catch {
    return { ok: true, data: trimmed };
  }
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
