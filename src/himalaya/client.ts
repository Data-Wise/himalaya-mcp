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
      });
      return stdout;
    } catch (err: unknown) {
      throw this.wrapError(err);
    }
  }

  /** List envelopes in a folder. */
  async listEnvelopes(folder?: string, pageSize?: number, page?: number): Promise<string> {
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
    return this.exec(args, { folder: f });
  }

  /** Search envelopes with a query string. */
  async searchEnvelopes(query: string, folder?: string): Promise<string> {
    const args = ["envelope", "list"];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    args.push("-q", query);
    return this.exec(args, { folder: f });
  }

  /** Read a message body (plain text). */
  async readMessage(id: string, folder?: string): Promise<string> {
    const args = ["message", "read", id];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f });
  }

  /** Read a message body (HTML). */
  async readMessageHtml(id: string, folder?: string): Promise<string> {
    const args = ["message", "read", "--html", id];
    const f = folder || this.opts.folder;
    if (f && f !== "INBOX") {
      args.push("--folder", f);
    }
    return this.exec(args, { folder: f });
  }

  /** List folders. */
  async listFolders(): Promise<string> {
    return this.exec(["folder", "list"]);
  }

  /** List accounts. */
  async listAccounts(): Promise<string> {
    return this.exec(["account", "list"]);
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
