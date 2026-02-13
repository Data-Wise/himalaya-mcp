/**
 * MCP tools for listing and searching emails.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseEnvelopes } from "../himalaya/parser.js";

export function registerInboxTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("list_emails", {
    description: "List emails in a folder. Returns envelope data: subject, from, date, flags.",
    inputSchema: {
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      page_size: z.number().optional().describe("Number of emails to return (default: 25)"),
      page: z.number().optional().describe("Page number for pagination"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    const raw = await client.listEnvelopes(args.folder, args.page_size, args.page);
    const result = parseEnvelopes(raw);

    if (!result.ok) {
      return { content: [{ type: "text" as const, text: `Error: ${result.error}` }], isError: true };
    }

    const summary = result.data.map((e) => {
      const flags = e.flags.length > 0 ? ` [${e.flags.join(", ")}]` : "";
      const attachment = e.has_attachment ? " [attachment]" : "";
      return `${e.id} | ${e.date} | ${e.from.name || e.from.addr} | ${e.subject}${flags}${attachment}`;
    }).join("\n");

    return {
      content: [{
        type: "text" as const,
        text: `Found ${result.data.length} emails:\n\n${summary}`,
      }],
    };
  });

  server.registerTool("search_emails", {
    description: "Search emails using himalaya filter syntax. Examples: 'subject invoice', 'from paypal', 'subject meeting and from boss'. Operators: and, or, not. Conditions: subject, from, to, body, date, before, after, flag.",
    inputSchema: {
      query: z.string().describe("Search query in himalaya filter syntax (e.g. 'subject invoice', 'from alice and subject meeting')"),
      folder: z.string().optional().describe("Folder to search in (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    const raw = await client.searchEnvelopes(args.query, args.folder);
    const result = parseEnvelopes(raw);

    if (!result.ok) {
      return { content: [{ type: "text" as const, text: `Error: ${result.error}` }], isError: true };
    }

    if (result.data.length === 0) {
      return { content: [{ type: "text" as const, text: `No emails found matching "${args.query}"` }] };
    }

    const summary = result.data.map((e) => {
      const flags = e.flags.length > 0 ? ` [${e.flags.join(", ")}]` : "";
      return `${e.id} | ${e.date} | ${e.from.name || e.from.addr} | ${e.subject}${flags}`;
    }).join("\n");

    return {
      content: [{
        type: "text" as const,
        text: `Found ${result.data.length} emails matching "${args.query}":\n\n${summary}`,
      }],
    };
  });
}
