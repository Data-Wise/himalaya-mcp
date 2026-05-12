/**
 * Subprocess wrapper for himalaya CLI.
 * Uses execFile (not exec) to prevent shell injection.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { HimalayaClientOptions } from "./types.js";
import { classifyStderr, HimalayaError } from "./errors.js";

const execFileAsync = promisify(execFile);

const DEFAULT_OPTIONS: Required<HimalayaClientOptions> = {
  binary: "himalaya",
  account: "",
  folder: "INBOX",
  timeout: 120_000,
  retryBackoffMs: 200,
};

const MAX_ATTEMPTS = 2;

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
   *
   * Retries once with backoff on transient failures (ECONNRESET, ETIMEDOUT, * BYE).
   * Auth/cert/not-found and timeout errors are NOT retried — user-action required.
   */
  async exec(subcommand: string[], options?: {
    folder?: string;
    account?: string;
    timeout?: number;
    cwd?: string;
  }): Promise<string> {
    let lastErr: HimalayaError | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.execOnce(subcommand, options);
      } catch (err) {
        if (!(err instanceof HimalayaError)) throw err;
        lastErr = err;
        if (err.envelope.code !== "transient" || attempt === MAX_ATTEMPTS) {
          err.envelope.attempts = attempt;
          throw err;
        }
        if (this.opts.retryBackoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.opts.retryBackoffMs));
        }
      }
    }
    // Unreachable — loop either returns or throws.
    throw lastErr;
  }

  /** Single-attempt subprocess invocation. */
  private async execOnce(subcommand: string[], options?: {
    folder?: string;
    account?: string;
    timeout?: number;
    cwd?: string;
  }): Promise<string> {
    const args: string[] = [];

    // Subcommand first (himalaya v1.1.0 expects flags after subcommand)
    args.push(...subcommand);

    // Subcommand flags
    const account = options?.account || this.opts.account;
    if (account) {
      args.push("--account", account);
    }

    // Output format
    args.push("--output", "json");

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
      throw this.wrapError(err, account);
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

  /** Download ALL attachments for a message to a directory. */
  async downloadAttachments(id: string, destDir: string, folder?: string, account?: string): Promise<string> {
    const args = ["attachment", "download", id];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f, account, cwd: destDir });
  }

  /**
   * Wrap a subprocess error into a HimalayaError carrying a structured envelope.
   *
   * Process-level errors (ENOENT, timeout) are detected before stderr classification
   * because execFile attaches them as properties on the Error, not in stderr.
   * Other failures route through {@link classifyStderr} for pattern matching.
   */
  private wrapError(err: unknown, account = ""): HimalayaError {
    const accountName = account || this.opts.account || undefined;

    if (err instanceof Error) {
      // CLI not found — binary missing on PATH
      if ("code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return new HimalayaError({
          code: "himalaya_not_installed",
          message: `himalaya CLI not found at "${this.opts.binary}"`,
          hint: "Run: brew install himalaya",
          account: accountName,
          recoverable: true,
        });
      }

      // Timeout — process killed via SIGTERM by execFile timeout
      if ("killed" in err && (err as { killed: boolean }).killed) {
        return new HimalayaError({
          code: "imap_timeout",
          message: `himalaya command timed out after ${this.opts.timeout}ms`,
          hint: "Check network or VPN, or increase HIMALAYA_TIMEOUT",
          account: accountName,
          recoverable: true,
        });
      }

      // Otherwise classify stderr (or err.message if stderr is empty)
      const stderr = (err as { stderr?: string }).stderr ?? "";
      const text = stderr.trim() ? stderr : err.message;
      return new HimalayaError(classifyStderr(text, accountName));
    }

    return new HimalayaError({
      code: "unknown",
      message: `himalaya unknown error: ${String(err)}`,
      account: accountName,
      recoverable: false,
    });
  }
}
