/**
 * MCP prompt: weekly_email_digest
 *
 * Guides Claude to create a markdown digest of the week's important emails,
 * grouped by priority and day.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerWeeklyDigestPrompt(server: McpServer) {
  server.registerPrompt("weekly_email_digest", {
    title: "Weekly Email Digest",
    description: "Create a markdown digest of this week's important emails, grouped by priority and day.",
  }, async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Create a weekly email digest:",
              "",
              "1. Use list_emails (page_size: 200) to get recent emails",
              "2. Use read_email on each to understand content",
              "3. Group emails by day, then by priority:",
              "",
              "## Format",
              "",
              "```markdown",
              "# Weekly Email Digest — [Date Range]",
              "",
              "## Monday",
              "### 🔴 Requires Action",
              "- **[Subject]** from [Sender] — [one-line summary]",
              "### 🟡 FYI / Review",
              "- **[Subject]** from [Sender]",
              "",
              "## Tuesday",
              "...",
              "",
              "## Summary",
              "- Total emails this week: [count]",
              "- Requires action: [count]",
              "- FYI: [count]",
              "- Low priority: [count]",
              "```",
              "",
              "4. Highlight any emails with deadlines, calendar invites, or action items",
              "5. Suggest which emails to reply to first",
            ].join("\n"),
          },
        },
      ],
    };
  });
}
