/**
 * Parse himalaya's config.toml to extract account email addresses
 * when HIMALAYA_FROM is not explicitly set.
 *
 * Syntax: TOML `[accounts.<name>]` sections with `email = "..."` keys.
 * Default account found via `default = true` or `[accounts.personal]`.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Result of parsing a himalaya config.toml file. */
export interface HimalayaConfigToml {
  /** Account name → email address mapping. */
  accounts: Map<string, { email: string; isDefault: boolean }>;
}

/** Regex matches `[accounts.<name>]` section header. */
const SECTION_RE = /^\[accounts\.(.+?)\]\s*$/;

/** Regex matches `key = "value"` or `key = 'value'`. */
const KEYVAL_RE = /^(\S+?)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*$/;

/**
 * Read and parse himalaya's config.toml.
 *
 * Path resolution (in order):
 *   1. `HIMALAYA_CONFIG` env var (absolute or ~/ relative)
 *   2. `~/.config/himalaya/config.toml` (default)
 */
export function parseConfigToml(
  customPath?: string,
): HimalayaConfigToml {
  const path = resolveConfigPath(customPath);
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n");

  const accounts = new Map<string, { email: string; isDefault: boolean }>();
  let currentAccount: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Section header
    const secMatch = line.match(SECTION_RE);
    if (secMatch) {
      currentAccount = secMatch[1];
      const existing = accounts.get(currentAccount);
      if (!existing) {
        accounts.set(currentAccount, { email: "", isDefault: false });
      }
      continue;
    }

    // Key-value pair inside current section
    if (currentAccount) {
      // Check for `default = true` (boolean)
      if (/^default\s*=\s*true\s*$/i.test(line)) {
        const entry = accounts.get(currentAccount);
        if (entry) entry.isDefault = true;
        continue;
      }
      // Check for `email = "..."` or `email = '...'`
      const kv = line.match(KEYVAL_RE);
      if (kv && kv[1] === "email") {
        const val = kv[2] !== undefined ? kv[2] : kv[3];
        const entry = accounts.get(currentAccount);
        if (entry) entry.email = val;
        continue;
      }
    }
  }

  return { accounts };
}

/**
 * Resolve the effective sender email.
 *
 * Priority:
 *   1. `HIMALAYA_FROM` env var
 *   2. himalaya config.toml → default account's email
 *   3. himalaya config.toml → explicit account's email (from HIMALAYA_ACCOUNT)
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

/** Resolve the config.toml path. */
function resolveConfigPath(customPath?: string): string {
  if (customPath) {
    if (customPath.startsWith("~/")) {
      return join(homedir(), customPath.slice(2));
    }
    return customPath;
  }
  const envPath = process.env["HIMALAYA_CONFIG"];
  if (envPath && !envPath.startsWith("${")) {
    return resolveConfigPath(envPath);
  }
  return join(homedir(), ".config", "himalaya", "config.toml");
}
