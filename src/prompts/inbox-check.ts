/**
 * MCP prompt: inbox_check
 *
 * Guides Claude to do a quick inbox status check with unread count,
 * highlights, and suggested next actions.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerInboxCheckPrompt(server: McpServer) {
  server.registerPrompt("inbox_check", {
    title: "Inbox Check",
    description: "Quick inbox status check with unread count, highlights, and suggested next actions.",
    argsSchema: {
      account: z.string().optional().describe("Email account to check (uses default if omitted)"),
      folder: z.string().optional().describe("Folder to check (default: INBOX)"),
    },
  }, async ({ account, folder }) => {
    const folderName = folder || "INBOX";
    const accountArg = account ? `, account: "${account}"` : "";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Quick check on my ${folderName} inbox:`,
              "",
              `1. Use list_emails (folder: "${folderName}"${accountArg}) to get recent emails`,
              "2. Count total and unread emails",
              "3. Highlight any flagged or important messages",
              "4. Show a brief summary:",
              "",
              "## Output Format",
              "",
              "```",
              `Inbox: [folder] — X unread of Y total`,
              "",
              "Flagged:",
              "- **[Subject]** from [Sender]",
              "",
              "Recent (last 5):",
              "- [Subject] — [Sender] — [time ago]",
              "```",
              "",
              "5. Suggest next actions based on what you see:",
              "   - Read a specific email",
              "   - Triage unread emails",
              "   - Reply to flagged messages",
              "   - Run a full morning briefing",
            ].join("\n"),
          },
        },
      ],
    };
  });
}
