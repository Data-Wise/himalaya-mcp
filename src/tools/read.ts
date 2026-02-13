/**
 * MCP tools for reading email messages.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseMessageBody } from "../himalaya/parser.js";

export function registerReadTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("read_email", {
    description: "Read an email message body (plain text). Use the ID from list_emails or search_emails.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    const raw = await client.readMessage(args.id, args.folder, args.account);
    const result = parseMessageBody(raw);

    if (!result.ok) {
      return { content: [{ type: "text" as const, text: `Error: ${result.error}` }], isError: true };
    }

    return {
      content: [{
        type: "text" as const,
        text: result.data || "(empty message body)",
      }],
    };
  });

  server.registerTool("read_email_html", {
    description: "Read an email message body as HTML. Useful for formatted emails.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    const raw = await client.readMessageHtml(args.id, args.folder, args.account);
    const result = parseMessageBody(raw);

    if (!result.ok) {
      return { content: [{ type: "text" as const, text: `Error: ${result.error}` }], isError: true };
    }

    return {
      content: [{
        type: "text" as const,
        text: result.data || "(empty message body)",
      }],
    };
  });
}
