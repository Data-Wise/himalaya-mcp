/**
 * himalaya-mcp setup CLI — manage Claude Desktop MCP server configuration.
 *
 * Subcommands:
 *   setup         Add MCP server to Claude Desktop config
 *   setup --check Verify configuration
 *   setup --remove Remove MCP server entry
 */

import { existsSync } from "node:fs";
import {
  CONFIG_PATH,
  SERVER_KEY,
  SERVER_CONFIG,
  type DesktopConfig,
  readConfig,
  writeConfig,
} from "./shared.js";

export function setup(): void {
  const config = readConfig();
  config.mcpServers = config.mcpServers ?? {};
  config.mcpServers[SERVER_KEY] = SERVER_CONFIG;
  writeConfig(config);
  console.log("Added himalaya MCP server to Claude Desktop config.");
  console.log(`  Config: ${CONFIG_PATH}`);
  console.log("  Restart Claude Desktop to activate.");
}

export function check(): void {
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

  const entryPoint = server.args[0];
  if (entryPoint && !existsSync(entryPoint)) {
    console.log(`  Warning: ${entryPoint} not found`);
    process.exit(1);
  }

  console.log("  Status: OK");
}

export function remove(): void {
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
