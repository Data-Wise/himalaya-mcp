/**
 * himalaya-mcp — Privacy-first email MCP server
 *
 * Wraps himalaya CLI via subprocess to provide email access
 * through MCP tools, resources, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HimalayaClient } from "./himalaya/client.js";
import { loadConfig } from "./config.js";
import { registerClipboardTools } from "./adapters/clipboard.js";
import { registerInboxTools } from "./tools/inbox.js";
import { registerReadTools } from "./tools/read.js";
import { registerManageTools } from "./tools/manage.js";
import { registerActionTools } from "./tools/actions.js";
import { registerResources } from "./resources/index.js";
import { registerTriagePrompt } from "./prompts/triage.js";
import { registerSummarizePrompt } from "./prompts/summarize.js";
import { registerDigestPrompt } from "./prompts/digest.js";
import { registerComposeTools } from "./tools/compose.js";
import { registerComposeNewTools } from "./tools/compose-new.js";
import { registerFolderTools } from "./tools/folders.js";
import { registerAttachmentTools } from "./tools/attachments.js";
import { registerCalendarTools } from "./tools/calendar.js";
import { registerThreadTools } from "./tools/threads.js";
import { registerHealthTools } from "./tools/health.js";
import { registerUnreadTools } from "./tools/unread.js";
import { registerReadRawTools } from "./tools/read-raw.js";
import { registerRenderTools } from "./tools/render.js";
import { registerStarredTools } from "./tools/list-starred.js";
import { registerReminderTools } from "./tools/reminders.js";
import { registerSnoozeTools } from "./tools/snooze.js";
import { registerWeeklyDigestPrompt } from "./prompts/weekly-digest.js";
import { registerReplyPrompt } from "./prompts/reply.js";
import { registerMorningPrompt } from "./prompts/morning.js";
import { registerInboxCheckPrompt } from "./prompts/inbox-check.js";

export const VERSION = "2.1.2";
export const NAME = "himalaya-mcp";
export const TOOL_COUNT = 29;

const server = new McpServer({
  name: NAME,
  version: VERSION,
});

const client = new HimalayaClient(loadConfig());

// Register tools
registerInboxTools(server, client);
registerReadTools(server, client);
registerManageTools(server, client);
registerActionTools(server, client);
registerComposeTools(server, client);
registerComposeNewTools(server, client);
registerFolderTools(server, client);
registerAttachmentTools(server, client);
registerCalendarTools(server, client);
registerThreadTools(server, client);
registerHealthTools(server, client);
registerClipboardTools(server);
registerUnreadTools(server, client);
registerReadRawTools(server, client);
registerRenderTools(server, client);
registerStarredTools(server, client);
registerReminderTools(server);
registerSnoozeTools(server);

// Register resources
registerResources(server, client);

// Register prompts
registerTriagePrompt(server);
registerSummarizePrompt(server);
registerDigestPrompt(server);
registerReplyPrompt(server);
registerMorningPrompt(server);
registerInboxCheckPrompt(server);
registerWeeklyDigestPrompt(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
