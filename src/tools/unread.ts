/**
 * get_unread_count MCP tool.
 *
 * Returns the number of unread emails in a folder or account.
 * Uses himalaya's server-side filter (`not flag Seen`) so it's
 * fast even for large mailboxes.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { envelopeError } from "./_envelope.js";

export function registerUnreadTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("get_unread_count", {
    description: "Get the number of unread emails in a folder (or across all folders). Uses himalaya's server-side filter for fast counting even in large mailboxes.",
    inputSchema: {
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const count = await client.getUnreadCount(args.folder, args.account);
      return {
        content: [{ type: "text" as const, text: String(count) }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
