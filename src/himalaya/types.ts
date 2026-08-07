/**
 * TypeScript types for himalaya CLI JSON output.
 * Canonical shapes below are based on himalaya v1.1.0 --output json responses;
 * himalaya v2.x wire shapes are defined separately and normalized in parser.ts.
 */

// --- Address ---

export interface Address {
  name: string | null;
  addr: string;
}

// --- Envelope (from `himalaya envelope list`) ---

export interface Envelope {
  id: string;
  flags: Flag[];
  subject: string;
  from: Address;
  to: Address;
  date: string;
  has_attachment: boolean;
}

export type Flag = "Seen" | "Answered" | "Flagged" | "Deleted" | "Draft" | string;

// --- Folder (from `himalaya folder list`) ---

export interface Folder {
  name: string;
  desc: string;
}

// --- Account (from `himalaya account list`) ---

export interface Account {
  name: string;
  backend: string;
  default: boolean;
}

// --- Message body (from `himalaya message read`) ---
// himalaya returns the body as a plain JSON string

export type MessageBody = string;

// --- V2 wire shapes (himalaya v2.x --json output) ---
// himalaya v2.0.0 renamed `--output json` to `--json` and wrapped bare array
// responses in named objects ({"mailboxes":[...]}, {"envelopes":[...]}).
// Field shapes also drifted: `flags` are {raw, iana} objects, `from`/`to` are
// arrays, `has-attachment` is kebab-case null|bool, and mailbox objects have no
// `desc` field. These types describe the raw wire JSON; parser.ts normalizes
// them into the canonical Envelope/Folder shapes above.

export interface V2Flag {
  raw: string;
  iana: string;
}

export interface V2Address {
  name: string | null;
  email: string;
}

export interface V2Envelope {
  id: string;
  "message-id"?: string;
  flags: V2Flag[];
  subject: string;
  from: V2Address[];
  to: V2Address[];
  date: string;
  size?: number;
  "has-attachment": boolean | null;
}

export interface V2Mailbox {
  id: string;
  name: string;
  total: number | null;
  unread: number | null;
}

export interface V2EnvelopeList {
  envelopes: V2Envelope[];
}

export interface V2MailboxList {
  mailboxes: V2Mailbox[];
}

// --- Client options ---

export interface HimalayaClientOptions {
  /** Path to himalaya binary (default: "himalaya") */
  binary?: string;
  /** Account name to use (--account flag) */
  account?: string;
  /** Default folder (default: "INBOX") */
  folder?: string;
  /** Timeout in milliseconds (default: 120000; 0 = unlimited) */
  timeout?: number;
  /** Backoff delay in milliseconds between retry attempts (default: 200) */
  retryBackoffMs?: number;
  /** Sender email address for compose/send (or derived from Himalaya config) */
  from?: string;
}

// --- Command result ---

export interface CommandResult<T> {
  ok: true;
  data: T;
}

export interface CommandError {
  ok: false;
  error: string;
  code?: string;
}

export type CommandOutput<T> = CommandResult<T> | CommandError;

// --- Tool parameters ---

export interface ListEmailsParams {
  folder?: string;
  page_size?: number;
  page?: number;
  account?: string;
}

export interface SearchEmailsParams {
  query: string;
  folder?: string;
  account?: string;
}

export interface ReadEmailParams {
  id: string;
  folder?: string;
  account?: string;
}

export interface FlagEmailParams {
  id: string;
  flags: string[];
  action: "add" | "remove";
  folder?: string;
  account?: string;
}

export interface MoveEmailParams {
  id: string;
  target_folder: string;
  folder?: string;
  account?: string;
}

export interface ExportMarkdownParams {
  id: string;
  folder?: string;
  account?: string;
}

export interface DraftReplyParams {
  id: string;
  body?: string;
  reply_all?: boolean;
  folder?: string;
  account?: string;
}

export interface SendEmailParams {
  /** Raw MML template (headers + body) to send */
  template: string;
  /** Local file paths to attach */
  attachments?: string[];
  /** Must be true to actually send — safety gate */
  confirm?: boolean;
  account?: string;
}

export interface CreateActionItemParams {
  id: string;
  folder?: string;
  account?: string;
}

export interface ComposeEmailParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  /** Local file paths to attach */
  attachments?: string[];
  confirm?: boolean;
  account?: string;
}

// --- Folder management parameters ---

export interface ListFoldersParams {
  account?: string;
}

export interface CreateFolderParams {
  name: string;
  account?: string;
}

export interface DeleteFolderParams {
  name: string;
  confirm?: boolean;
  account?: string;
}

// --- Attachment types ---

export interface DownloadAttachmentsParams {
  id: string;
  folder?: string;
  account?: string;
}

// --- Calendar types ---

export interface CalendarEvent {
  summary: string;
  dtstart: string;
  dtend: string;
  location?: string;
  organizer?: string;
  description?: string;
  uid?: string;
}

export interface ExtractCalendarEventParams {
  id: string;
  folder?: string;
  account?: string;
}

// --- Thread types ---

export interface Thread {
  /** ID of the first message in the thread (used as thread_id) */
  thread_id: string;
  /** Normalized subject line (stripped of Re:/Fwd: prefixes) */
  subject: string;
  /** Number of messages in the thread */
  message_count: number;
  /** Participants (unique senders) */
  participants: Address[];
  /** Date of the most recent message */
  latest_date: string;
  /** Date of the first message */
  earliest_date: string;
  /** Envelopes in the thread, sorted chronologically */
  messages: Envelope[];
  /** Whether any message in the thread is unread */
  has_unread: boolean;
}

export interface ListThreadsParams {
  folder?: string;
  page_size?: number;
  page?: number;
  account?: string;
}

export interface ReadThreadParams {
  thread_id: string;
  folder?: string;
  account?: string;
}

export interface CreateCalendarEventParams {
  summary: string;
  dtstart: string;
  dtend: string;
  location?: string;
  description?: string;
  confirm?: boolean;
}
