/**
 * himalaya-mcp — Privacy-first email MCP server
 *
 * Wraps himalaya CLI via subprocess to provide email access
 * through MCP tools, resources, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { HimalayaClient } from "./himalaya/client.js";
import { registerInboxTools } from "./tools/inbox.js";
import { registerReadTools } from "./tools/read.js";
import { registerResources } from "./resources/index.js";

export const VERSION = "0.1.0";
export const NAME = "himalaya-mcp";

const server = new McpServer({
  name: NAME,
  version: VERSION,
});

const client = new HimalayaClient();

// Register tools
registerInboxTools(server, client);
registerReadTools(server, client);

// Register resources
registerResources(server, client);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
