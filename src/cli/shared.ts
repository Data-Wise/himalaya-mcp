/**
 * Shared utilities for the himalaya-mcp CLI.
 *
 * Used by all CLI subcommand modules (setup, doctor, extension).
 * Centralizes config paths, server entry resolution, and the CLI dispatcher.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

/** Claude Desktop config directory per platform. */
export function getConfigDir(): string {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", "Claude");
    case "win32": {
      const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
      return join(appData, "Claude");
    }
    default:
      return join(homedir(), ".config", "Claude");
  }
}

export const CONFIG_DIR = getConfigDir();
export const CONFIG_PATH = join(CONFIG_DIR, "claude_desktop_config.json");

export const EXTENSION_ID = "himalaya-mcp";
export const EXTENSIONS_DIR = join(CONFIG_DIR, "Claude Extensions");
export const EXTENSIONS_SETTINGS_DIR = join(CONFIG_DIR, "Claude Extensions Settings");
export const INSTALLATIONS_PATH = join(CONFIG_DIR, "extensions-installations.json");

/**
 * Find dist/index.js — the MCP server entry point.
 *
 * Resolution order:
 *   1. Relative to this script (works for Homebrew, source, and symlinked installs)
 *   2. Claude Code plugin path (~/.claude/plugins/himalaya-mcp/dist/index.js)
 */
export function findServerEntry(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const distDir = dirname(dirname(realpathSync(thisFile)));
  const relativeEntry = join(distDir, "index.js");
  if (existsSync(relativeEntry)) {
    return relativeEntry;
  }

  const pluginEntry = join(homedir(), ".claude", "plugins", "himalaya-mcp", "dist", "index.js");
  if (existsSync(pluginEntry)) {
    return pluginEntry;
  }

  return relativeEntry;
}

export const SERVER_KEY = "himalaya";
export const SERVER_CONFIG = {
  command: "node",
  args: [findServerEntry()],
};

export interface DesktopConfig {
  mcpServers?: Record<string, { command: string; args: string[] }>;
  [key: string]: unknown;
}

export function readConfig(): DesktopConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  try {
    return JSON.parse(raw) as DesktopConfig;
  } catch {
    console.error(`Error: Failed to parse config at ${CONFIG_PATH}`);
    console.error("  The file contains invalid JSON. Please fix it manually.");
    process.exit(1);
  }
}

export function writeConfig(config: DesktopConfig): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
  } catch {
    console.error(`Error: Failed to write config to ${CONFIG_PATH}`);
    console.error("  Check file permissions and try again.");
    process.exit(1);
  }
}

/** Get the package version from package.json relative to this file. */
export function getVersion(): string {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const projectRoot = dirname(dirname(dirname(realpathSync(thisFile))));
    const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf-8")) as { version?: string };
    return pkg.version || "";
  } catch {
    return "";
  }
}

/** Parse --account <name> from CLI args. */
export function parseAccountFlag(args: string[]): string | undefined {
  const idx = args.indexOf("--account");
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

/** Print the unified help message. */
export function printHelp(): void {
  const version = getVersion();
  console.log(`himalaya-mcp CLI${version ? ` v${version}` : ""}`);
  console.log("");
  console.log("Usage: himalaya-mcp <command> [flags]");
  console.log("");
  console.log("Setup (Claude Desktop):");
  console.log("  setup                     Add MCP server to Claude Desktop config (default)");
  console.log("  setup --check, check      Verify configuration");
  console.log("  setup --remove, remove    Remove MCP server entry");
  console.log("");
  console.log("Desktop extension (.mcpb):");
  console.log("  install-ext [file]        Install .mcpb as Desktop extension");
  console.log("  remove-ext                Remove Desktop extension");
  console.log("");
  console.log("Diagnostics:");
  console.log("  doctor                    Diagnose installation and per-account connectivity");
  console.log("  doctor --account <name>   Run checks for a specific account only");
  console.log("  doctor --fix              Auto-fix common issues");
  console.log("  doctor --json             Machine-readable output");
  console.log("");
  console.log("Meta:");
  console.log("  --version, -v             Print version and exit");
  console.log("  --help, -h, help          Print this help and exit");
  console.log("");
  console.log("Examples:");
  console.log("  himalaya-mcp setup                    # First-time install");
  console.log("  himalaya-mcp doctor --account work    # Diagnose one account");
  console.log("  himalaya-mcp doctor --json | jq .     # Pipe diagnostics to jq");
  console.log("");
  console.log("Docs: https://data-wise.github.io/himalaya-mcp/");
}

/** Detect if THIS module is the main entry point. Call from the file being run. */
export function isMain(importMetaUrl: string = import.meta.url): boolean {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return importMetaUrl === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}
