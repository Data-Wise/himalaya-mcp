/**
 * RFC 5322 message building and parsing for himalaya v2.
 *
 * himalaya v2 dropped templates and MML: `message send` and `message add`
 * take a finished RFC 5322 message, and its docs point richer composition
 * at an external composer. This module is that composer (nodemailer's
 * MailComposer) and the matching reader (postal-mime), so the MCP tools
 * can review, edit and send messages as readable text on v2.
 */

import MailComposer from "nodemailer/lib/mail-composer";
import PostalMime, { type Email } from "postal-mime";
import { basename } from "node:path";

export interface OutgoingMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: string[];
}

/**
 * Build a complete RFC 5322 message.
 *
 * `Bcc` is kept in the output: himalaya derives the SMTP envelope from the
 * headers (and strips the field before transmission), and a saved draft
 * must keep it.
 */
export async function buildMessage(m: OutgoingMessage): Promise<string> {
  const composer = new MailComposer({
    from: m.from,
    to: m.to,
    cc: m.cc || undefined,
    bcc: m.bcc || undefined,
    subject: m.subject,
    text: m.text,
    inReplyTo: m.inReplyTo || undefined,
    references: m.references || undefined,
    attachments: (m.attachments ?? []).map((path) => ({ path, filename: basename(path) })),
  });
  // keepBcc lives on the compiled node, not on the composer options.
  const node = composer.compile();
  (node as unknown as { keepBcc: boolean }).keepBcc = true;
  const raw = await node.build();
  return raw.toString("utf8");
}

/** Parse a raw RFC 5322 message (any transfer encoding, multipart or not). */
export async function parseMessage(raw: string): Promise<Email> {
  return PostalMime.parse(raw);
}

function addressList(list: Email["to"]): string {
  return (list ?? [])
    .flatMap((a) => ("group" in a && a.group ? a.group : [a]))
    .map((a) => (a.name ? `"${a.name.replace(/"/g, "")}" <${a.address}>` : `${a.address}`))
    .join(", ");
}

/** The bare addresses of a parsed list, lowercased. */
export function addresses(list: Email["to"]): string[] {
  return (list ?? [])
    .flatMap((a) => ("group" in a && a.group ? a.group : [a]))
    .map((a) => (a.address ?? "").toLowerCase())
    .filter(Boolean);
}

/**
 * Render a parsed message as a reviewable template: the headers that
 * matter for sending, a blank line, then the decoded text body. It parses
 * back with {@link parseMessage}, so a reviewed template can be sent as is.
 */
export function renderForReview(email: Email): string {
  const headers: string[] = [];
  if (email.from) headers.push(`From: ${addressList([email.from])}`);
  if (email.to?.length) headers.push(`To: ${addressList(email.to)}`);
  if (email.cc?.length) headers.push(`Cc: ${addressList(email.cc)}`);
  if (email.bcc?.length) headers.push(`Bcc: ${addressList(email.bcc)}`);
  headers.push(`Subject: ${email.subject ?? ""}`);
  if (email.inReplyTo) headers.push(`In-Reply-To: ${email.inReplyTo}`);
  if (email.references) headers.push(`References: ${email.references}`);
  return headers.join("\n") + "\n\n" + (email.text ?? "").replace(/\r\n/g, "\n");
}

/** Turn a reviewed template (or any raw message) back into sendable fields. */
export async function templateToMessage(
  template: string,
  defaults: { from: string },
): Promise<OutgoingMessage> {
  const email = await parseMessage(template);
  const to = addressList(email.to);
  if (!to) throw new Error("The template has no To: recipient");
  return {
    from: email.from ? addressList([email.from]) : defaults.from,
    to,
    cc: addressList(email.cc) || undefined,
    bcc: addressList(email.bcc) || undefined,
    subject: email.subject ?? "",
    text: (email.text ?? "").replace(/\r\n/g, "\n"),
    inReplyTo: email.inReplyTo,
    references: email.references,
  };
}
