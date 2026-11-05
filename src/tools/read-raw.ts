/**
 * read_email_raw MCP tool.
 *
 * Returns the raw MIME source of an email (see HimalayaClient.readRawMessage:
 * `message export --full` on v1, `message read --raw` on v2).
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { envelopeError } from "./_envelope.js";

export function registerReadRawTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("read_email_raw", {
    description: "Read the raw MIME source of an email. Returns the full, unedited message including all headers. Useful for debugging, email forensics, and exporting to .eml format.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const raw = await client.readRawMessage(args.id, args.folder, args.account);
      return {
        content: [{ type: "text" as const, text: raw }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
