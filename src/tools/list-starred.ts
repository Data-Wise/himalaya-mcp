/**
 * list_starred MCP tool.
 *
 * Convenience tool that lists all flagged/starred emails.
 * Thin wrapper over `search_emails` with `flag Flagged` filter.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseEnvelopes } from "../himalaya/parser.js";
import { formatEnvelope } from "../himalaya/parser.js";
import { envelopeError } from "./_envelope.js";

export function registerStarredTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("list_starred", {
    description: "List all flagged/starred emails. Returns envelopes with flag, subject, sender, and date. Uses server-side filtering for fast results.",
    inputSchema: {
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const raw = await client.searchEnvelopes("flag Flagged", args.folder, args.account);
      const result = parseEnvelopes(raw);
      if (!result.ok) {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
      if (result.data.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No starred (flagged) emails." }],
        };
      }
      const lines = result.data.map(formatEnvelope);
      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
