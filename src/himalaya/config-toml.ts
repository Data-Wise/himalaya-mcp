/** Parse Himalaya configuration to extract account email addresses. */

import { parse as parseToml } from "@iarna/toml";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Result of parsing a himalaya config.toml file. */
export interface HimalayaConfigToml {
  /** Account name → email address mapping. */
  accounts: Map<string, { email: string; isDefault: boolean }>;
}

/**
 * Read and parse Himalaya's TOML configuration.
 *
 * Path resolution (in order):
 *   1. Explicit path, if supplied
 *   2. `HIMALAYA_CONFIG` app override
 *   3. `$XDG_CONFIG_HOME/himalaya/config.toml`
 *   4. `~/.config/himalaya/config.toml`
 *   5. `~/.himalayarc`
 */
export function parseConfigToml(customPath?: string): HimalayaConfigToml {
  const accounts = new Map<string, { email: string; isDefault: boolean }>();
  const paths = resolveConfigPaths(customPath);
  let found = false;

  for (const path of paths) {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch (error) {
      if (isMissingFile(error) && paths.length > 1) continue;
      throw error;
    }
    found = true;
    mergeAccounts(accounts, parseToml(content));
  }

  if (!found) {
    throw new Error(`No Himalaya configuration file found in: ${paths.join(", ")}`);
  }

  return { accounts };
}

/**
 * Resolve the effective sender email.
 *
 * Priority:
 *   1. `HIMALAYA_FROM` env var
 *   2. Himalaya config.toml → explicit account's email
 *   3. Himalaya config.toml → default account's email
 *
 * Returns undefined if no source has a sender address.
 */
export function resolveFromAddress(
  account?: string,
): string | undefined {
  // 1. Explicit env var
  const envFrom = process.env["HIMALAYA_FROM"];
  if (envFrom && !envFrom.startsWith("${")) return envFrom;

  // 2. Try config.toml
  try {
    const config = parseConfigToml();
    // Explicit account first (if specified)
    if (account) {
      const info = config.accounts.get(account);
      if (info?.email) return info.email;
    }
    // Default account
    for (const [, info] of config.accounts) {
      if (info.isDefault && info.email) return info.email;
    }
    // Any account with an email
    for (const [, info] of config.accounts) {
      if (info.email) return info.email;
    }
  } catch {
    // Config file missing or unreadable — caller handles undefined
  }

  return undefined;
}

/** Resolve the config files accepted by the Himalaya CLI. */
function resolveConfigPaths(customPath?: string): string[] {
  if (customPath) {
    return [expandHome(customPath)];
  }
  const envPath = process.env["HIMALAYA_CONFIG"];
  if (envPath && !envPath.startsWith("${")) {
    return [expandHome(envPath)];
  }

  const home = getHomeDir();
  const xdgHome = process.env["XDG_CONFIG_HOME"];
  return [
    xdgHome && !xdgHome.startsWith("${")
      ? join(expandHome(xdgHome), "himalaya", "config.toml")
      : undefined,
    join(home, ".config", "himalaya", "config.toml"),
    join(home, ".himalayarc"),
  ].filter((path): path is string => Boolean(path));
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? join(getHomeDir(), path.slice(2)) : path;
}

function getHomeDir(): string {
  const home = process.env["HOME"];
  return home && !home.startsWith("${") ? home : homedir();
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT";
}

function mergeAccounts(
  accounts: Map<string, { email: string; isDefault: boolean }>,
  document: Record<string, unknown>,
): void {
  const accountTables = asObject(document.accounts);
  if (!accountTables) return;

  for (const [name, rawAccount] of Object.entries(accountTables)) {
    const account = asObject(rawAccount);
    if (!account) continue;
    const existing = accounts.get(name) ?? { email: "", isDefault: false };
    if (typeof account.email === "string") existing.email = account.email;
    if (typeof account.default === "boolean") existing.isDefault = account.default;
    accounts.set(name, existing);
  }
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
