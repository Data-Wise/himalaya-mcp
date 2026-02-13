/**
 * himalaya-mcp — Privacy-first email MCP server
 *
 * Wraps himalaya CLI via subprocess to provide email access
 * through MCP tools, resources, and prompts.
 *
 * Phase 1 (MVP): list_emails, read_email, search_emails, list_folders
 * Phase 2: triage prompts, flag_email, export_to_markdown
 * Phase 3: draft_reply, send_email (with safety gate), move_email
 * Phase 4: adapters (obsidian, apple, clipboard)
 * Phase 5: Claude Code plugin (skills, agents, hooks)
 */

// TODO: Phase 1 implementation
// import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export const VERSION = "0.1.0";
export const NAME = "himalaya-mcp";
