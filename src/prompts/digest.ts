/**
 * MCP prompt: daily_email_digest
 *
 * Guides Claude to create a markdown digest of today's important emails,
 * grouped by priority.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDigestPrompt(server: McpServer) {
  server.registerPrompt("daily_email_digest", {
    title: "Daily Email Digest",
    description: "Create a markdown digest of today's important emails, grouped by priority.",
  }, async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Create a daily email digest:",
              "",
              "1. Use list_emails (page_size: 50) to get recent emails",
              "2. Use read_email on each to understand content",
              "3. Group emails by priority:",
              "",
              "## Format",
              "",
              "```markdown",
              "# Email Digest — [Today's Date]",
              "",
              "## 🔴 Requires Action",
              "- **[Subject]** from [Sender] — [one-line summary]",
              "",
              "## 🟡 FYI / Review",
              "- **[Subject]** from [Sender] — [one-line summary]",
              "",
              "## ⚪ Low Priority",
              "- **[Subject]** from [Sender] — [one-line summary]",
              "",
              "## Stats",
              "- Total: X emails",
              "- Action needed: X",
              "- FYI: X",
              "- Low priority: X",
              "```",
              "",
              "Only include emails from today. If no emails today, expand to the last 24 hours.",
              "After generating the digest, offer to export it using export_to_markdown or flag emails.",
            ].join("\n"),
          },
        },
      ],
    };
  });
}
