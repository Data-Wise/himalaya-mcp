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

export function loadConfig(): HimalayaClientOptions {
  const config: HimalayaClientOptions = {};

  if (process.env.HIMALAYA_BINARY) {
    config.binary = process.env.HIMALAYA_BINARY;
  }

  if (process.env.HIMALAYA_ACCOUNT) {
    config.account = process.env.HIMALAYA_ACCOUNT;
  }

  if (process.env.HIMALAYA_FOLDER) {
    config.folder = process.env.HIMALAYA_FOLDER;
  }

  if (process.env.HIMALAYA_TIMEOUT) {
    const timeout = parseInt(process.env.HIMALAYA_TIMEOUT, 10);
    if (!isNaN(timeout) && timeout > 0) {
      config.timeout = timeout;
    }
  }

  return config;
}
