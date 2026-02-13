/**
 * TypeScript types for himalaya CLI JSON output.
 * Based on himalaya v1.1.0 --output json responses.
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

// --- Client options ---

export interface HimalayaClientOptions {
  /** Path to himalaya binary (default: "himalaya") */
  binary?: string;
  /** Account name to use (--account flag) */
  account?: string;
  /** Default folder (default: "INBOX") */
  folder?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
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
  /** Must be true to actually send — safety gate */
  confirm?: boolean;
  account?: string;
}

export interface CreateActionItemParams {
  id: string;
  folder?: string;
  account?: string;
}
