/**
 * render_email MCP tool.
 *
 * Renders an email body as clean markdown. For HTML emails,
 * converts HTML to markdown using node-html-markdown. For
 * plain text emails, returns the body as-is.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { envelopeError } from "./_envelope.js";
import { parseMessageBody } from "../himalaya/parser.js";

export function registerRenderTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("render_email", {
    description: "Read an email body rendered as clean markdown. For HTML emails, converts to markdown for a clean reading experience. For plain text emails, returns the body as-is.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      // Try HTML first — parse the JSON-quoted HTML body
      const htmlRaw = await client.readMessageHtml(args.id, args.folder, args.account);
      const htmlResult = parseMessageBody(htmlRaw);
      if (htmlResult.ok && htmlResult.data && htmlResult.data.length > 0) {
        const { NodeHtmlMarkdown } = await import("node-html-markdown");
        const markdown = NodeHtmlMarkdown.translate(htmlResult.data);
        return {
          content: [{ type: "text" as const, text: markdown }],
        };
      }

      // Fallback to plain text
      const textRaw = await client.readMessage(args.id, args.folder, args.account);
      const result = parseMessageBody(textRaw);
      if (!result.ok) {
        return {
          content: [{ type: "text" as const, text: `Error reading email: ${result.error}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: result.data || "(empty body)" }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
