#!/usr/bin/env node
/**
 * himalaya-mcp setup CLI
 *
 * Manages MCP server configuration for Claude Desktop.
 *
 * Usage:
 *   himalaya-mcp setup              # Add MCP server to Claude Desktop config
 *   himalaya-mcp setup --check      # Verify configuration
 *   himalaya-mcp setup --remove     # Remove MCP server entry
 *   himalaya-mcp install-ext [file] # Install .mcpb as Claude Desktop extension
 *   himalaya-mcp remove-ext         # Remove extension from Claude Desktop
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

function getConfigDir(): string {
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

/**
 * Find dist/index.js — the MCP server entry point.
 *
 * Resolution order:
 *   1. Relative to this script (works for Homebrew, source, and symlinked installs)
 *   2. Claude Code plugin path (~/.claude/plugins/himalaya-mcp/dist/index.js)
 */
function findServerEntry(): string {
  // This script is at dist/cli/setup.js — index.js is at dist/index.js
  const thisFile = fileURLToPath(import.meta.url);
  const distDir = dirname(dirname(realpathSync(thisFile)));
  const relativeEntry = join(distDir, "index.js");
  if (existsSync(relativeEntry)) {
    return relativeEntry;
  }

  // Fallback: Claude Code plugin symlink
  const pluginEntry = join(homedir(), ".claude", "plugins", "himalaya-mcp", "dist", "index.js");
  if (existsSync(pluginEntry)) {
    return pluginEntry;
  }

  // Last resort: return the relative path (setup --check will warn if missing)
  return relativeEntry;
}

const CONFIG_DIR = getConfigDir();
const CONFIG_PATH = join(CONFIG_DIR, "claude_desktop_config.json");

const SERVER_KEY = "himalaya";
const SERVER_CONFIG = {
  command: "node",
  args: [findServerEntry()],
};

interface DesktopConfig {
  mcpServers?: Record<string, { command: string; args: string[] }>;
  [key: string]: unknown;
}

function readConfig(): DesktopConfig {
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

function writeConfig(config: DesktopConfig): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
  } catch {
    console.error(`Error: Failed to write config to ${CONFIG_PATH}`);
    console.error("  Check file permissions and try again.");
    process.exit(1);
  }
}

function setup(): void {
  const config = readConfig();
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[SERVER_KEY] = SERVER_CONFIG;
  writeConfig(config);
  console.log("Added himalaya MCP server to Claude Desktop config.");
  console.log(`  Config: ${CONFIG_PATH}`);
  console.log("  Restart Claude Desktop to activate.");
}

function check(): void {
  if (!existsSync(CONFIG_PATH)) {
    console.log("Claude Desktop config not found.");
    console.log(`  Expected: ${CONFIG_PATH}`);
    console.log("  Run: himalaya-mcp setup");
    process.exit(1);
  }

  const config = readConfig();
  const server = config.mcpServers?.[SERVER_KEY];

  if (!server) {
    console.log("himalaya MCP server not configured.");
    console.log("  Run: himalaya-mcp setup");
    process.exit(1);
  }

  console.log("himalaya MCP server is configured.");
  console.log(`  Command: ${server.command}`);
  console.log(`  Args: ${server.args.join(" ")}`);

  // Verify the entry point exists
  const entryPoint = server.args[0];
  if (entryPoint && !existsSync(entryPoint)) {
    console.log(`  Warning: ${entryPoint} not found`);
    process.exit(1);
  }

  console.log("  Status: OK");
}

function remove(): void {
  if (!existsSync(CONFIG_PATH)) {
    console.log("Claude Desktop config not found. Nothing to remove.");
    return;
  }

  const config = readConfig();
  if (!config.mcpServers?.[SERVER_KEY]) {
    console.log("himalaya MCP server not in config. Nothing to remove.");
    return;
  }

  delete config.mcpServers[SERVER_KEY];
  writeConfig(config);
  console.log("Removed himalaya MCP server from Claude Desktop config.");
  console.log("  Restart Claude Desktop to apply.");
}

// --- Extension (.mcpb) installation ---

const EXTENSION_ID = "himalaya-mcp";
const EXTENSIONS_DIR = join(CONFIG_DIR, "Claude Extensions");
const EXTENSIONS_SETTINGS_DIR = join(CONFIG_DIR, "Claude Extensions Settings");
const INSTALLATIONS_PATH = join(CONFIG_DIR, "extensions-installations.json");

interface ExtensionManifest {
  name: string;
  version: string;
  [key: string]: unknown;
}

interface ExtensionEntry {
  id: string;
  version: string;
  hash: string;
  installedAt: string;
  manifest: ExtensionManifest;
  signatureInfo: { status: string };
  source: string;
}

interface ExtensionsRegistry {
  extensions: Record<string, ExtensionEntry>;
}

function readExtensionsRegistry(): ExtensionsRegistry {
  if (!existsSync(INSTALLATIONS_PATH)) {
    return { extensions: {} };
  }
  const raw = readFileSync(INSTALLATIONS_PATH, "utf-8");
  try {
    return JSON.parse(raw) as ExtensionsRegistry;
  } catch {
    console.error(`Error: Failed to parse ${INSTALLATIONS_PATH}`);
    process.exit(1);
  }
}

function writeExtensionsRegistry(registry: ExtensionsRegistry): void {
  writeFileSync(INSTALLATIONS_PATH, JSON.stringify(registry) + "\n", "utf-8");
}

function findMcpbFile(explicitPath?: string): string {
  if (explicitPath) {
    const resolved = resolve(explicitPath);
    if (!existsSync(resolved)) {
      console.error(`Error: File not found: ${resolved}`);
      process.exit(1);
    }
    return resolved;
  }

  // Look for .mcpb in project root (relative to this script)
  const thisFile = fileURLToPath(import.meta.url);
  const projectRoot = dirname(dirname(dirname(realpathSync(thisFile))));

  const files = readdirSync(projectRoot).filter(
    (f: string) => f.startsWith("himalaya-mcp-v") && f.endsWith(".mcpb")
  );

  if (files.length === 0) {
    console.error("Error: No .mcpb file found. Run: npm run build:mcpb");
    process.exit(1);
  }

  files.sort();
  return join(projectRoot, files[files.length - 1]);
}

function installExtension(mcpbPath?: string): void {
  const file = findMcpbFile(mcpbPath);
  console.log(`Installing extension from: ${file}`);

  const extDir = join(EXTENSIONS_DIR, EXTENSION_ID);

  // Unpack using mcpb CLI (execFileSync avoids shell injection)
  mkdirSync(EXTENSIONS_DIR, { recursive: true });
  if (existsSync(extDir)) {
    rmSync(extDir, { recursive: true });
  }

  try {
    execFileSync("npx", ["--yes", "@anthropic-ai/mcpb", "unpack", file, extDir], {
      stdio: "pipe",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: Failed to unpack .mcpb: ${message}`);
    process.exit(1);
  }

  // Read the unpacked manifest
  const manifestPath = join(extDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.error("Error: Unpacked extension missing manifest.json");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ExtensionManifest;

  // Calculate hash of the .mcpb file
  const fileBuffer = readFileSync(file);
  const hash = createHash("sha256").update(fileBuffer).digest("hex");

  // Register in extensions-installations.json
  const registry = readExtensionsRegistry();
  registry.extensions[EXTENSION_ID] = {
    id: EXTENSION_ID,
    version: manifest.version,
    hash,
    installedAt: new Date().toISOString(),
    manifest,
    signatureInfo: { status: "unsigned" },
    source: "local",
  };
  writeExtensionsRegistry(registry);

  // Create default settings file (enabled with empty user config)
  const settingsPath = join(EXTENSIONS_SETTINGS_DIR, `${EXTENSION_ID}.json`);
  mkdirSync(EXTENSIONS_SETTINGS_DIR, { recursive: true });
  if (!existsSync(settingsPath)) {
    writeFileSync(
      settingsPath,
      JSON.stringify({ isEnabled: true, userConfig: {} }, null, 2) + "\n",
      "utf-8"
    );
  }

  console.log(`Installed himalaya-mcp v${manifest.version} as Claude Desktop extension.`);
  console.log(`  Extension dir: ${extDir}`);
  console.log(`  Settings: ${settingsPath}`);
  console.log("  Restart Claude Desktop to activate.");
}

function removeExtension(): void {
  const extDir = join(EXTENSIONS_DIR, EXTENSION_ID);
  const settingsPath = join(EXTENSIONS_SETTINGS_DIR, `${EXTENSION_ID}.json`);

  let removed = false;

  if (existsSync(extDir)) {
    rmSync(extDir, { recursive: true });
    console.log(`Removed extension directory: ${extDir}`);
    removed = true;
  }

  const registry = readExtensionsRegistry();
  if (registry.extensions[EXTENSION_ID]) {
    delete registry.extensions[EXTENSION_ID];
    writeExtensionsRegistry(registry);
    console.log("Removed from extensions registry.");
    removed = true;
  }

  if (existsSync(settingsPath)) {
    rmSync(settingsPath);
    console.log("Removed extension settings.");
    removed = true;
  }

  if (!removed) {
    console.log("himalaya-mcp extension not installed. Nothing to remove.");
    return;
  }

  console.log("  Restart Claude Desktop to apply.");
}

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0];

if (command === "--check" || command === "check") {
  check();
} else if (command === "--remove" || command === "remove") {
  remove();
} else if (command === "install-ext") {
  installExtension(args[1]);
} else if (command === "remove-ext") {
  removeExtension();
} else if (!command || command === "setup") {
  setup();
} else {
  console.log("himalaya-mcp setup CLI");
  console.log("");
  console.log("Usage:");
  console.log("  himalaya-mcp setup              Add MCP server to Claude Desktop config");
  console.log("  himalaya-mcp setup --check      Verify configuration");
  console.log("  himalaya-mcp setup --remove     Remove MCP server entry");
  console.log("  himalaya-mcp install-ext [file]  Install .mcpb as Desktop extension");
  console.log("  himalaya-mcp remove-ext          Remove Desktop extension");
}
