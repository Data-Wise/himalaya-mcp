/**
 * Subprocess wrapper for himalaya CLI.
 * Uses execFile (not exec) to prevent shell injection.
 */

import { execFile } from "node:child_process";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { HimalayaClientOptions } from "./types.js";
import { classifyStderr, HimalayaError } from "./errors.js";

const execFileAsync = promisify(execFile);

// himalaya uses Clap, so any argv that starts with "-" is parsed as a flag.
// Reject those for user-provided values to prevent flag smuggling
// (e.g. query="--config /tmp/evil.toml" or target_folder="--help").
function assertSafeArg(value: string, field: string): void {
  if (value.startsWith("-")) {
    throw new Error(
      `${field} value "${value}" looks like a flag (starts with "-"). ` +
      `Refusing to pass it to himalaya.`,
    );
  }
}

// Tokenize a search query with quote awareness, so `subject "meeting notes"`
// becomes two tokens instead of three. Supports single and double quotes.
// Unbalanced quotes fall through to whitespace splitting of the remainder.
function tokenizeQuery(query: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(query)) !== null) {
    const token = match[1] ?? match[2] ?? match[3];
    if (token !== undefined && token.length > 0) {
      tokens.push(token);
    }
  }
  return tokens;
}

const DEFAULT_OPTIONS: Required<HimalayaClientOptions> = {
  binary: "himalaya",
  account: "",
  folder: "INBOX",
  timeout: 120_000,
  retryBackoffMs: 200,
  from: "",
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

  /** Sender email address (from HIMALAYA_FROM env var). */
  get from(): string {
    return this.opts.from;
  }

  // Resolve the effective folder, validate it, and append --folder to `args`
  // if it differs from the implicit INBOX default. Returns the effective folder.
  private applyFolderArg(args: string[], folder: string | undefined): string {
    const f = folder || this.opts.folder;
    if (f && f.toUpperCase() !== "INBOX") {
      assertSafeArg(f, "folder");
      args.push("--folder", f);
    }
    return f;
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
    /** Positional args appended after all flags (e.g. reply body) */
    trailingArgs?: string[];
  }): Promise<string> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.execOnce(subcommand, options);
      } catch (err) {
        if (!(err instanceof HimalayaError)) throw err;
        if (err.envelope.code !== "transient" || attempt === MAX_ATTEMPTS) {
          err.envelope.attempts = attempt;
          throw err;
        }
        if (this.opts.retryBackoffMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.opts.retryBackoffMs));
        }
      }
    }
    // Loop above either returns or throws on the final attempt; reaching
    // here means MAX_ATTEMPTS was set to 0 or the loop logic regressed.
    throw new Error("HimalayaClient.exec: retry loop exited without resolution");
  }

  /** Single-attempt subprocess invocation. */
  private async execOnce(subcommand: string[], options?: {
    folder?: string;
    account?: string;
    timeout?: number;
    cwd?: string;
    trailingArgs?: string[];
  }): Promise<string> {
    const args: string[] = [];

    // Subcommand first (himalaya v1.1.0 expects flags after subcommand)
    args.push(...subcommand);

    // Subcommand flags
    const account = options?.account || this.opts.account;
    if (account) {
      assertSafeArg(account, "account");
      args.push("--account", account);
    }

    // Output format
    args.push("--output", "json");

    // Positional args must come after all flags (e.g. reply body)
    if (options?.trailingArgs?.length) {
      args.push(...options.trailingArgs);
    }

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
    const f = this.applyFolderArg(args, folder);
    if (pageSize) {
      args.push("--page-size", String(pageSize));
    }
    if (page) {
      args.push("--page", String(page));
    }
    return this.exec(args, { folder: f, account });
  }

  /**
   * Get the unread count for a folder.
   * Uses himalaya filter syntax: `not flag Seen`.
   */
  async getUnreadCount(folder?: string, account?: string): Promise<number> {
    const raw = await this.searchEnvelopes("not flag Seen", folder, account);
    const { parseEnvelopes } = await import("./parser.js");
    const result = parseEnvelopes(raw);
    if (result.ok) {
      return result.data.length;
    }
    return 0;
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
    const f = this.applyFolderArg(args, folder);
    // Query words are positional args to himalaya (not a -q flag).
    // Tokenize with quote awareness so `subject "meeting notes"` works,
    // and refuse any token that would be parsed as a flag.
    const tokens = tokenizeQuery(query);
    for (const token of tokens) {
      assertSafeArg(token, "query");
    }
    args.push(...tokens);
    return this.exec(args, { folder: f, account });
  }

  /** Read a message body (plain text). */
  async readMessage(id: string, folder?: string, account?: string): Promise<string> {
    assertSafeArg(id, "id");
    const args = ["message", "read", id];
    const f = this.applyFolderArg(args, folder);
    return this.exec(args, { folder: f, account });
  }

  /** Read a message body (HTML).
   *
   * himalaya v1.2.0 removed the --html flag from `message read`.
   * Instead, use `message export` (without --full) which exports
   * MIME parts as separate files: index.html for HTML, plain.txt for text.
   */
  async readMessageHtml(id: string, folder?: string, account?: string): Promise<string> {
    assertSafeArg(id, "id");
    const tmpDir = mkdtempSync(join(tmpdir(), "himalaya-mcp-html-"));
    try {
      const args = ["message", "export"];
      const f = folder || this.opts.folder;
      if (f && f.toUpperCase() !== "INBOX") {
        args.push("--folder", f);
      }
      args.push("--destination", tmpDir, id);
      // Note: exec() already appends --account and --output json
      await this.exec(args, { folder: f, account });
      const htmlPath = join(tmpDir, "index.html");
      return readFileSync(htmlPath, "utf-8");
    } finally {
      try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    }
  }

  /** Add or remove flags on a message. */
  async flagMessage(
    id: string,
    flags: string[],
    action: "add" | "remove",
    folder?: string,
    account?: string,
  ): Promise<string> {
    assertSafeArg(id, "id");
    for (const flag of flags) {
      assertSafeArg(flag, "flag");
    }
    const args = ["flag", action, id, ...flags];
    const f = this.applyFolderArg(args, folder);
    return this.exec(args, { folder: f, account });
  }

  /** Move a message to a different folder. */
  async moveMessage(
    id: string,
    targetFolder: string,
    folder?: string,
    account?: string,
  ): Promise<string> {
    assertSafeArg(id, "id");
    assertSafeArg(targetFolder, "target_folder");
    const args = ["message", "move", targetFolder, id];
    const f = this.applyFolderArg(args, folder);
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
    assertSafeArg(id, "id");
    const args = ["template", "reply"];
    const f = this.applyFolderArg(args, folder);
    if (replyAll) {
      args.push("--all");
    }
    args.push(id);
    // Body must come after --output json (trailingArgs), and must not
    // start with "-" to avoid flag confusion.
    const trailingArgs = body ? (assertSafeArg(body, "body"), [body]) : undefined;
    return this.exec(args, { folder: f, account, trailingArgs });
  }

  /**
   * Send a template (MML format) via stdin.
   * Uses spawn() with an args array — no shell involved, safe for multiline templates.
   * Positional-arg approach breaks for multiline MML; stdin is the correct path.
   */
  async sendTemplate(
    template: string,
    account?: string,
  ): Promise<string> {
    // Template going to stdin, not CLI args — but reject leading-dash as sanity check.
    if (template.startsWith("-")) {
      throw new Error(
        `template value "${template.slice(0, 20)}" looks like a flag (starts with "-"). ` +
        `Refusing to pass it to himalaya.`,
      );
    }

    const { spawn } = await import("node:child_process");

    const args = ["template", "send", "--output", "json"];
    const acct = account || this.opts.account;
    if (acct) {
      assertSafeArg(acct, "account");
      args.push("--account", acct);
    }

    return new Promise((resolve, reject) => {
      // spawn with an args array — no shell, no injection risk
      const child = spawn(this.opts.binary, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(this.wrapError(new Error(`himalaya error: ${stderr || stdout}`)));
        }
      });

      child.on("error", (err: Error) => reject(this.wrapError(err)));

      child.stdin.write(template);
      child.stdin.end();

      setTimeout(() => {
        child.kill();
        reject(new Error("Send timed out"));
      }, this.opts.timeout);
    });
  }

  /** List folders. */
  async listFolders(account?: string): Promise<string> {
    return this.exec(["folder", "list"], { account });
  }

  /** Create a folder. */
  async createFolder(name: string, account?: string): Promise<string> {
    assertSafeArg(name, "name");
    return this.exec(["folder", "create", name], { account });
  }

  /** Delete a folder. */
  async deleteFolder(name: string, account?: string): Promise<string> {
    assertSafeArg(name, "name");
    // --yes suppresses the interactive confirmation prompt that himalaya prints
    // to stdout, which would block when invoked as a subprocess (no TTY).
    return this.exec(["folder", "delete", "--yes", name], { account });
  }

  /** List accounts. */
  async listAccounts(): Promise<string> {
    return this.exec(["account", "list"]);
  }

  /** Download ALL attachments for a message to a directory. */
  async downloadAttachments(id: string, destDir: string, folder?: string, account?: string): Promise<string> {
    assertSafeArg(id, "id");
    assertSafeArg(destDir, "destDir");
    const args = ["attachment", "download", "--downloads-dir", destDir, id];
    const f = this.applyFolderArg(args, folder);
    return this.exec(args, { folder: f, account });
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
