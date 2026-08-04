/**
 * Account discovery wrapper around `himalaya account list --json`.
 *
 * Used by doctor and health_check to enumerate configured accounts
 * for per-account diagnostics.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "../config.js";
import { HimalayaError, parseError } from "./errors.js";

const execFileAsync = promisify(execFile);
const ACCOUNT_TIMEOUT = 15_000;

export interface Account {
  name: string;
  isDefault: boolean;
  /**
   * Configured backends for this account (e.g. ["imap", "smtp"]), normalized
   * from either the v1-style singular `backend` field or the v2-style plural
   * `backends` array. Undefined/empty means "unknown" -- callers that need to
   * confirm a specific backend (e.g. isImapAccount) must fail closed on that,
   * never assume IMAP.
   */
  backends?: string[];
}

interface HimalayaAccountJson {
  name: string;
  default: boolean;
  backend?: string;
  backends?: string[];
}

interface HimalayaAccountListJson {
  accounts: HimalayaAccountJson[];
}

export async function listAccounts(): Promise<Account[]> {
  const binary = loadConfig().binary ?? "himalaya";
  let stdout: string;
  try {
    const result = await execFileAsync(binary, ["account", "list", "--json"], { timeout: ACCOUNT_TIMEOUT });
    stdout = result.stdout;
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HimalayaError({
        code: "himalaya_not_installed",
        message: `himalaya CLI not installed (ENOENT). Run: brew install himalaya`,
        hint: "Run: brew install himalaya",
        recoverable: true,
      });
    }
    throw err;
  }
  try {
    const parsed = JSON.parse(stdout) as HimalayaAccountJson[] | HimalayaAccountListJson;
    const accounts = Array.isArray(parsed) ? parsed : parsed.accounts;
    if (!Array.isArray(accounts)) {
      throw new Error("Expected account list JSON array or object with accounts array");
    }
    return accounts.map((a) => ({
      name: a.name,
      isDefault: a.default,
      backends: normalizeBackends(a),
    }));
  } catch (err: unknown) {
    throw parseError(
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function getDefaultAccount(): Promise<string | null> {
  const accounts = await listAccounts();
  return accounts.find((a) => a.isDefault)?.name ?? null;
}

function normalizeBackends(a: HimalayaAccountJson): string[] | undefined {
  if (Array.isArray(a.backends) && a.backends.length > 0) return a.backends;
  if (typeof a.backend === "string" && a.backend.length > 0) return [a.backend];
  return undefined;
}

/**
 * Fail-closed IMAP-backend check. Returns false (never assume IMAP) when
 * `backends` is missing, empty, or contains no recognized "imap" entry --
 * only a confirmed "imap" backend returns true.
 */
export function isImapAccount(account: Pick<Account, "backends">): boolean {
  return Array.isArray(account.backends) && account.backends.includes("imap");
}
