/**
 * MCP prompt: morning_briefing
 *
 * Guides Claude through a comprehensive morning email briefing with
 * urgency classification, calendar events, and action items.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerMorningPrompt(server: McpServer) {
  server.registerPrompt("morning_briefing", {
    title: "Morning Briefing",
    description: "Comprehensive morning email briefing with urgency classification, calendar events, and action items.",
    argsSchema: {
      account: z.string().optional().describe("Email account to check (uses default if omitted)"),
    },
  }, async ({ account }) => {
    const accountNote = account ? ` for account "${account}"` : "";
    const accountArg = account ? `, account: "${account}"` : "";
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Give me a morning email briefing${accountNote}:`,
              "",
              `1. Use list_emails (page_size: 50${accountArg}) to get recent emails`,
              "2. Filter to emails from the last 24 hours",
              "3. Use read_email on each unread email to understand the content",
              "4. Classify each email by urgency:",
              "   - **Needs Reply Today** — requires a response or decision",
              "   - **FYI** — informational, worth knowing about",
              "   - **Newsletter** — subscriptions and digests",
              "   - **Automated** — notifications, CI alerts, receipts",
              "",
              "5. Summarize the top 5 most urgent emails (1 sentence each)",
              "6. Check for calendar invites — use extract_calendar_event on any ICS attachments",
              "7. List action items from flagged or actionable emails",
              "",
              "## Output Format",
              "",
              "```",
              "# Morning Briefing — [Today's Date]",
              "",
              "## Urgent (Needs Reply Today)",
              "- **[Subject]** from [Sender] — [one-line summary]",
              "",
              "## FYI",
              "- **[Subject]** from [Sender] — [one-line summary]",
              "",
              "## Calendar Events",
              "- [Event Title] — [Date/Time] — [Organizer]",
              "",
              "## Action Items",
              "- [ ] [Task] — from [email subject]",
              "",
              "## Stats",
              "- Unread: X | Urgent: X | FYI: X | Newsletters: X | Automated: X",
              "```",
              "",
              "After the briefing, offer next actions:",
              "- Triage remaining emails",
              "- Reply to an urgent email",
              "- Flag emails for follow-up",
              "- Export briefing using export_to_markdown",
            ].join("\n"),
          },
        },
      ],
    };
  });
}
