/**
 * MCP prompt: triage_inbox
 *
 * Guides Claude to classify recent emails as actionable/FYI/skip
 * and suggest flags or folder moves.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTriagePrompt(server: McpServer) {
  server.registerPrompt("triage_inbox", {
    title: "Triage Inbox",
    description: "Classify recent emails as actionable, FYI, or skip. Suggests flags and folder moves.",
    argsSchema: {
      count: z.string().optional().describe("Number of recent emails to triage (default: 10)"),
    },
  }, async ({ count }) => {
    const n = count || "10";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Triage my ${n} most recent emails. For each email:`,
              "",
              "1. Use list_emails (page_size: " + n + ") to get recent emails",
              "2. Use read_email on each to understand the content",
              "3. Classify each as:",
              "   - **Actionable** — requires a response or action from me",
              "   - **FYI** — informational, no action needed",
              "   - **Skip** — newsletter, notification, or spam",
              "",
              "4. For each email, suggest:",
              "   - Flags to add (e.g., Flagged for important, Seen for reviewed)",
              "   - Folder to move to (e.g., Archive for FYI, Trash for skip)",
              "",
              "Format your response as a table:",
              "| ID | From | Subject | Class | Suggested Action |",
              "|---|---|---|---|---|",
              "",
              "After the table, ask me which actions to execute.",
              "Do NOT flag or move anything without my confirmation.",
            ].join("\n"),
          },
        },
      ],
    };
  });
}
