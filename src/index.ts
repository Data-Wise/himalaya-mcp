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
import { registerReplyPrompt } from "./prompts/reply.js";

export const VERSION = "1.1.1";
export const NAME = "himalaya-mcp";

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
registerClipboardTools(server);

// Register resources
registerResources(server, client);

// Register prompts
registerTriagePrompt(server);
registerSummarizePrompt(server);
registerDigestPrompt(server);
registerReplyPrompt(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
