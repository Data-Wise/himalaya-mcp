#!/usr/bin/env node
/**
 * himalaya-mcp setup CLI
 *
 * Manages MCP server configuration for Claude Desktop.
 *
 * Usage:
 *   himalaya-mcp setup          # Add MCP server to Claude Desktop config
 *   himalaya-mcp setup --check  # Verify configuration
 *   himalaya-mcp setup --remove # Remove MCP server entry
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(
  homedir(),
  "Library",
  "Application Support",
  "Claude"
);
const CONFIG_PATH = join(CONFIG_DIR, "claude_desktop_config.json");

const SERVER_KEY = "himalaya";
const SERVER_CONFIG = {
  command: "node",
  args: [join(homedir(), ".claude", "plugins", "himalaya-mcp", "dist", "index.js")],
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

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0];

if (command === "--check" || command === "check") {
  check();
} else if (command === "--remove" || command === "remove") {
  remove();
} else if (!command || command === "setup") {
  setup();
} else {
  console.log("himalaya-mcp setup CLI");
  console.log("");
  console.log("Usage:");
  console.log("  himalaya-mcp setup          Add MCP server to Claude Desktop");
  console.log("  himalaya-mcp setup --check  Verify configuration");
  console.log("  himalaya-mcp setup --remove Remove MCP server entry");
}
