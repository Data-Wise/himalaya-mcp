/**
 * MCP prompt: summarize_email
 *
 * Guides Claude to produce a one-sentence summary and action items
 * for a specific email.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSummarizePrompt(server: McpServer) {
  server.registerPrompt("summarize_email", {
    title: "Summarize Email",
    description: "Produce a one-sentence summary and list action items for a specific email.",
    argsSchema: {
      id: z.string().describe("Email message ID to summarize"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
    },
  }, async ({ id, folder }) => {
    const folderNote = folder ? ` from folder "${folder}"` : "";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Summarize email ${id}${folderNote}:`,
              "",
              `1. Use read_email (id: "${id}"${folder ? `, folder: "${folder}"` : ""}) to get the full message`,
              "2. Provide:",
              "   - **One-sentence summary** — what is this email about?",
              "   - **Action items** — any tasks or responses needed (or 'None')",
              "   - **Priority** — High / Medium / Low",
              "   - **Suggested response** — brief reply suggestion if actionable",
            ].join("\n"),
          },
        },
      ],
    };
  });
}
