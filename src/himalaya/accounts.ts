/**
 * Account discovery wrapper around `himalaya account list -o json`.
 *
 * Used by doctor and health_check to enumerate configured accounts
 * for per-account diagnostics.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "../config.js";

const execFileAsync = promisify(execFile);

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
  try {
    const { stdout } = await execFileAsync(binary, ["account", "list", "-o", "json"]);
    let parsed: HimalayaAccountJson[];
    try {
      parsed = JSON.parse(stdout);
    } catch {
      throw new Error(`Failed to parse himalaya account list output`);
    }
    return parsed.map((a) => ({ name: a.name, isDefault: a.default }));
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new Error(`himalaya CLI not installed (ENOENT). Run: brew install himalaya`);
    }
    throw err;
  }
}

export async function getDefaultAccount(): Promise<string | null> {
  const accounts = await listAccounts();
  return accounts.find((a) => a.isDefault)?.name ?? null;
}
