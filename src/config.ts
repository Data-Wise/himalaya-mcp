/**
 * User configuration via environment variables.
 *
 * All settings are optional — sensible defaults are used.
 * Environment variables:
 *   HIMALAYA_BINARY  — path to himalaya binary (default: "himalaya")
 *   HIMALAYA_ACCOUNT — default account name
 *   HIMALAYA_FOLDER  — default folder (default: "INBOX")
 *   HIMALAYA_TIMEOUT — command timeout in ms (default: 30000)
 */

import type { HimalayaClientOptions } from "./himalaya/types.js";

/** Return the value only if it's a real string (not an unresolved template variable). */
function resolvedEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val || val.startsWith("${")) return undefined;
  return val;
}

export function loadConfig(): HimalayaClientOptions {
  const config: HimalayaClientOptions = {};

  const binary = resolvedEnv("HIMALAYA_BINARY");
  if (binary) config.binary = binary;

  const account = resolvedEnv("HIMALAYA_ACCOUNT");
  if (account) config.account = account;

  const folder = resolvedEnv("HIMALAYA_FOLDER");
  if (folder) config.folder = folder;

  const timeoutStr = resolvedEnv("HIMALAYA_TIMEOUT");
  if (timeoutStr) {
    const timeout = parseInt(timeoutStr, 10);
    if (!isNaN(timeout) && timeout > 0) config.timeout = timeout;
  }

  return config;
}
