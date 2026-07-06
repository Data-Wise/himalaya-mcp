/**
 * Account discovery wrapper around `himalaya account list -o json`.
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
}

interface HimalayaAccountJson {
  name: string;
  default: boolean;
  backend: string;
}

export async function listAccounts(): Promise<Account[]> {
  const binary = loadConfig().binary ?? "himalaya";
  let stdout: string;
  try {
    const result = await execFileAsync(binary, ["account", "list", "-o", "json"], { timeout: ACCOUNT_TIMEOUT });
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
    const parsed = JSON.parse(stdout) as HimalayaAccountJson[];
    return parsed.map((a) => ({ name: a.name, isDefault: a.default }));
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
