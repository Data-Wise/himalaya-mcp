/**
 * MCP tools for listing and searching emails.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseEnvelopes, formatEnvelope } from "../himalaya/parser.js";
import { parseError } from "../himalaya/errors.js";
import { envelopeError } from "./_envelope.js";

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
    try {
      const raw = await client.listEnvelopes(args.folder, args.page_size, args.page, args.account);
      const result = parseEnvelopes(raw);

      if (!result.ok) {
        return envelopeError(parseError(result.error, args.account));
      }

      const summary = result.data.map(formatEnvelope).join("\n");

      return {
        content: [{
          type: "text" as const,
          text: `Found ${result.data.length} emails:\n\n${summary}`,
        }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });

  server.registerTool("search_emails", {
    description: "Search emails using himalaya filter syntax. Combine conditions with `and`/`or` (REQUIRED between every condition pair — omitting them causes parse errors like 'expected `and`'). Multi-word values use backslash-escaped spaces (`subject quarterly\\ report`). Conditions: subject, from, to, body, date, before, after, flag. Examples: 'from paypal', 'subject invoice and after 2026-01-01', 'from alice and subject meeting', 'not body spam'.",
    inputSchema: {
      query: z.string().describe("Search query in himalaya filter syntax. Use `and`/`or` between every condition pair (e.g. 'from alice and after 2026-07-01', NOT 'from alice after 2026-07-01'). Multi-word values need backslash-escaped spaces (e.g. 'subject festival\\ of\\ running'). Use 'body <word>' to search email body text. Conditions: subject, from, to, body, date, before, after, flag."),
      folder: z.string().optional().describe("Folder to search in (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const raw = await client.searchEnvelopes(args.query, args.folder, args.account);
      const result = parseEnvelopes(raw);

      if (!result.ok) {
        return envelopeError(parseError(result.error, args.account));
      }

      if (result.data.length === 0) {
        return { content: [{ type: "text" as const, text: `No emails found matching "${args.query}"` }] };
      }

      const summary = result.data.map(formatEnvelope).join("\n");

      return {
        content: [{
          type: "text" as const,
          text: `Found ${result.data.length} emails matching "${args.query}":\n\n${summary}`,
        }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
