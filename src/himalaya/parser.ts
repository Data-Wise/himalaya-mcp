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
 * Unwrap a himalaya list response into a bare array, reporting which wire
 * shape was matched so callers can pick the right normalization.
 *
 * himalaya v1 returns bare arrays (`[...]`), while v2 wraps them in a named
 * object (`{"mailboxes":[...]}`, `{"envelopes":[...]}`). The matched shape is
 * authoritative: `"array"` means the elements are canonical v1 shapes, `"key"`
 * means they are v2 wire shapes, and `"none"` means the response had neither
 * shape (callers should fail loud rather than degrade to an empty list).
 */
export type ListUnwrap<T> = { matched: "array" | "key" | "none"; data: T[] };

export function unwrapList<T>(data: unknown, key: string): ListUnwrap<T> {
  if (Array.isArray(data)) return { matched: "array", data: data as T[] };
  if (data !== null && typeof data === "object") {
    const wrapped = (data as Record<string, unknown>)[key];
    if (Array.isArray(wrapped)) return { matched: "key", data: wrapped as T[] };
  }
  return { matched: "none", data: [] };
}

/** Map a v2 address (array of {name, email}) to the canonical single Address. */
function firstAddress(list: V2Address[]): Address {
  const first = list[0];
  return first ? { name: first.name, addr: first.email } : { name: null, addr: "" };
}

/**
 * Normalize a v2 envelope object to the canonical v1 Envelope shape.
 * Only called on the v2 wire shape (`{envelopes:[...]}`), so `from`/`to` are
 * arrays, `flags` are {raw, iana} objects, and attachment is kebab-case.
 */
function normalizeEnvelope(e: V2Envelope): Envelope {
  return {
    id: e.id,
    flags: e.flags.map((f) => f.raw.replace(/^\\/, "")),
    subject: e.subject,
    from: firstAddress(e.from),
    to: firstAddress(e.to),
    date: e.date,
    has_attachment: Boolean(e["has-attachment"]),
  };
}

/**
 * Normalize a v2 mailbox object to the canonical Folder shape.
 * v2 mailbox objects carry id/name/total/unread but no `desc`.
 */
function normalizeFolder(f: V2Mailbox): Folder {
  return { name: f.name, desc: "" };
}

/**
 * Parse envelope list response (v1 bare array or v2 {"envelopes":[...]}).
 * Fails loud with `parse_error` when the response has neither shape rather
 * than silently reporting an empty inbox.
 */
export function parseEnvelopes(raw: string): CommandOutput<Envelope[]> {
  const result = parse<unknown>(raw);
  if (!result.ok) return result;
  const { matched, data } = unwrapList<Envelope | V2Envelope>(result.data, "envelopes");
  if (matched === "none") {
    return {
      ok: false,
      error: "Unexpected envelope list response (expected an array or {envelopes:[...]})",
      code: "PARSE_ERROR",
    };
  }
  const list = matched === "array" ? (data as Envelope[]) : (data as V2Envelope[]).map(normalizeEnvelope);
  return { ok: true, data: list };
}

/**
 * Parse folder list response (v1 bare array or v2 {"mailboxes":[...]}).
 * Fails loud with `parse_error` when the response has neither shape rather
 * than silently reporting an empty folder list.
 */
export function parseFolders(raw: string): CommandOutput<Folder[]> {
  const result = parse<unknown>(raw);
  if (!result.ok) return result;
  const { matched, data } = unwrapList<Folder | V2Mailbox>(result.data, "mailboxes");
  if (matched === "none") {
    return {
      ok: false,
      error: "Unexpected folder list response (expected an array or {mailboxes:[...]})",
      code: "PARSE_ERROR",
    };
  }
  const list = matched === "array" ? (data as Folder[]) : (data as V2Mailbox[]).map(normalizeFolder);
  return { ok: true, data: list };
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
