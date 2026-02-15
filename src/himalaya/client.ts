/**
 * Subprocess wrapper for himalaya CLI.
 * Uses execFile (not exec) to prevent shell injection.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HimalayaClientOptions } from "./types.js";

const execFileAsync = promisify(execFile);

const DEFAULT_OPTIONS: Required<HimalayaClientOptions> = {
  binary: "himalaya",
  account: "",
  folder: "INBOX",
  timeout: 30_000,
};

export class HimalayaClient {
  private opts: Required<HimalayaClientOptions>;

  constructor(options: HimalayaClientOptions = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    // Remove empty strings so they don't override
    if (!options.account) this.opts.account = "";
    if (!options.folder) this.opts.folder = DEFAULT_OPTIONS.folder;
  }

  /**
   * Execute a himalaya CLI command and return raw stdout.
   * Always appends --output json.
   */
  async exec(subcommand: string[], options?: {
    folder?: string;
    account?: string;
    timeout?: number;
    cwd?: string;
  }): Promise<string> {
    const args: string[] = [];

    // Global flags
    const account = options?.account || this.opts.account;
    if (account) {
      args.push("--account", account);
    }

    // Output format
    args.push("--output", "json");

    // Subcommand and its args
    args.push(...subcommand);

    const timeout = options?.timeout ?? this.opts.timeout;

    try {
      const { stdout } = await execFileAsync(this.opts.binary, args, {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: { ...process.env },
        cwd: options?.cwd,
      });
      return stdout;
    } catch (err: unknown) {
      throw this.wrapError(err);
    }
  }

  /** List envelopes in a folder. */
  async listEnvelopes(folder?: string, pageSize?: number, page?: number, account?: string): Promise<string> {
    const args = ["envelope", "list"];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    if (pageSize) {
      args.push("--page-size", String(pageSize));
    }
    if (page) {
      args.push("--page", String(page));
    }
    return this.exec(args, { folder: f, account });
  }

  /**
   * Search envelopes with a query.
   * Uses himalaya filter syntax (positional args):
   *   "subject foo", "from bar", "body baz"
   *   Operators: "and", "or", "not"
   *   Example: "subject invoice and from paypal"
   */
  async searchEnvelopes(query: string, folder?: string, account?: string): Promise<string> {
    const args = ["envelope", "list"];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    // Query words are positional args to himalaya (not a -q flag)
    args.push(...query.split(" "));
    return this.exec(args, { folder: f, account });
  }

  /** Read a message body (plain text). */
  async readMessage(id: string, folder?: string, account?: string): Promise<string> {
    const args = ["message", "read", id];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f, account });
  }

  /** Read a message body (HTML). */
  async readMessageHtml(id: string, folder?: string, account?: string): Promise<string> {
    const args = ["message", "read", "--html", id];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f, account });
  }

  /** Add or remove flags on a message. */
  async flagMessage(
    id: string,
    flags: string[],
    action: "add" | "remove",
    folder?: string,
    account?: string,
  ): Promise<string> {
    const args = ["flag", action, id, ...flags];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f, account });
  }

  /** Move a message to a different folder. */
  async moveMessage(
    id: string,
    targetFolder: string,
    folder?: string,
    account?: string,
  ): Promise<string> {
    const args = ["message", "move", targetFolder, id];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f, account });
  }

  /** Generate a reply template for a message. */
  async replyTemplate(
    id: string,
    body?: string,
    replyAll?: boolean,
    folder?: string,
    account?: string,
  ): Promise<string> {
    const args = ["template", "reply"];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    if (replyAll) {
      args.push("--all");
    }
    args.push(id);
    if (body) {
      args.push(body);
    }
    return this.exec(args, { folder: f, account });
  }

  /** Send a template (MML format). */
  async sendTemplate(
    template: string,
    account?: string,
  ): Promise<string> {
    const args = ["template", "send", template];
    return this.exec(args, { account });
  }

  /** List folders. */
  async listFolders(account?: string): Promise<string> {
    return this.exec(["folder", "list"], { account });
  }

  /** Create a folder. */
  async createFolder(name: string, account?: string): Promise<string> {
    return this.exec(["folder", "create", name], { account });
  }

  /** Delete a folder. */
  async deleteFolder(name: string, account?: string): Promise<string> {
    return this.exec(["folder", "delete", name], { account });
  }

  /** List accounts. */
  async listAccounts(): Promise<string> {
    return this.exec(["account", "list"]);
  }

  /** List attachments for a message. */
  async listAttachments(id: string, folder?: string, account?: string): Promise<string> {
    const args = ["attachment", "list", id];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f, account });
  }

  /** Download an attachment to a directory. */
  async downloadAttachment(id: string, filename: string, destDir: string, folder?: string, account?: string): Promise<string> {
    const args = ["attachment", "download", id, filename];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f, account, cwd: destDir });
  }

  /** Wrap errors with meaningful messages. */
  private wrapError(err: unknown): Error {
    if (err instanceof Error) {
      const msg = err.message;

      // CLI not found
      if ("code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return new Error(
          `himalaya CLI not found at "${this.opts.binary}". Install with: brew install himalaya`
        );
      }

      // Timeout
      if ("killed" in err && (err as { killed: boolean }).killed) {
        return new Error(
          `himalaya command timed out after ${this.opts.timeout}ms`
        );
      }

      // Auth / connection errors
      if (msg.includes("authentication") || msg.includes("login")) {
        return new Error(`himalaya authentication failed: ${msg}`);
      }

      return new Error(`himalaya error: ${msg}`);
    }
    return new Error(`himalaya unknown error: ${String(err)}`);
  }
}
