/**
 * MCP tools for listing and searching emails.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseEnvelopes, formatEnvelope } from "../himalaya/parser.js";
import { parseError } from "../himalaya/errors.js";
import { envelopeError } from "./_envelope.js";

/** Auto-wrap bare single-word queries with `subject` prefix.
 *  himalaya's filter parser chokes on unqualified terms like "toilet"
 *  (interprets "to" as a field keyword, then "ilet" is garbage). */
export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return trimmed;                       // empty → pass through as-is
  const hasCondition = /^(subject|from|to|body|date|before|after|flag)\b/;
  if (hasCondition.test(trimmed)) return trimmed;
  if (/\s/.test(trimmed)) return trimmed;           // multi-word
  if (/\b(and|or|not)\b/i.test(trimmed)) return trimmed; // has operators
  return `subject ${trimmed}`;
}

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
    description: "Search emails using himalaya filter syntax. Examples: 'subject invoice', 'from paypal', 'subject meeting and from boss'. Operators: and, or, not. Conditions: subject, from, to, body, date, before, after, flag.",
    inputSchema: {
      query: z.string().describe("Search query in himalaya filter syntax (e.g. 'subject invoice', 'from alice and subject meeting')"),
      folder: z.string().optional().describe("Folder to search in (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const query = normalizeSearchQuery(args.query);

      const raw = await client.searchEnvelopes(query, args.folder, args.account);
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
