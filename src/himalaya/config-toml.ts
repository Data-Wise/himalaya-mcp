/** Parse Himalaya configuration to extract account email addresses. */

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
    mergeAccounts(accounts, parseConfigDocument(content));
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
  parsed: HimalayaConfigToml,
): void {
  for (const [name, info] of parsed.accounts) {
    const existing = accounts.get(name) ?? { email: "", isDefault: false };
    if (info.email) existing.email = info.email;
    existing.isDefault = existing.isDefault || info.isDefault;
    accounts.set(name, existing);
  }
}

function parseConfigDocument(content: string): HimalayaConfigToml {
  const accounts = new Map<string, { email: string; isDefault: boolean }>();
  let currentAccount: string | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (!line) continue;

    if (line.startsWith("[") && line.endsWith("]")) {
      const path = parseDottedPath(line.slice(1, -1).trim());
      currentAccount = path.length === 2 && path[0] === "accounts" ? path[1] : undefined;
      if (currentAccount && !accounts.has(currentAccount)) {
        accounts.set(currentAccount, { email: "", isDefault: false });
      }
      continue;
    }

    if (!currentAccount) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = parseDottedPath(line.slice(0, eqIndex).trim())[0];
    const value = parseValue(line.slice(eqIndex + 1).trim());
    const entry = accounts.get(currentAccount);
    if (!entry) continue;
    if (key === "email" && typeof value === "string") entry.email = value;
    if (key === "default" && typeof value === "boolean") entry.isDefault = value;
  }

  return { accounts };
}

function stripInlineComment(line: string): string {
  let quote: "'" | '"' | undefined;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && char === "\\") {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = undefined;
      continue;
    }
    if (char === "#" && !quote) return line.slice(0, i);
  }
  return line;
}

function parseDottedPath(input: string): string[] {
  const parts: string[] = [];
  let part = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (escaped) {
      part += char;
      escaped = false;
      continue;
    }
    if (quote === '"' && char === "\\") {
      part += char;
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      part += char;
      continue;
    }
    if (char === quote) {
      quote = undefined;
      part += char;
      continue;
    }
    if (char === "." && !quote) {
      parts.push(unquoteKey(part.trim()));
      part = "";
      continue;
    }
    part += char;
  }

  if (part.trim()) parts.push(unquoteKey(part.trim()));
  return parts;
}

function unquoteKey(key: string): string {
  if (key.startsWith('"') && key.endsWith('"')) return parseDoubleQuoted(key);
  if (key.startsWith("'") && key.endsWith("'")) return key.slice(1, -1);
  return key;
}

function parseValue(value: string): string | boolean | undefined {
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  if (value.startsWith('"') && value.endsWith('"')) return parseDoubleQuoted(value);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return undefined;
}

function parseDoubleQuoted(value: string): string {
  return JSON.parse(value) as string;
}
