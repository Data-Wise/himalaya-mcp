/**
 * MCP tool for composing new emails (not replies).
 *
 * Uses the same two-phase safety gate as send_email:
 * - Without confirm=true: returns a preview
 * - With confirm=true: actually sends via himalaya
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";

/** Build an MML email template from parameters. */
function buildTemplate(to: string, subject: string, body: string, cc?: string, bcc?: string): string {
  const headers: string[] = [];
  headers.push(`To: ${to}`);
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  headers.push(`Subject: ${subject}`);
  return headers.join("\n") + "\n\n" + body;
}

export function registerComposeNewTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("compose_email", {
    description: "Compose and send a new email (not a reply). SAFETY: requires confirm=true to actually send. Without confirm, returns a preview for user review.",
    inputSchema: {
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body text"),
      cc: z.string().optional().describe("CC recipient(s)"),
      bcc: z.string().optional().describe("BCC recipient(s)"),
      confirm: z.boolean().optional().describe("Set to true to actually send. Without this, only shows a preview."),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    const template = buildTemplate(args.to, args.subject, args.body, args.cc, args.bcc);

    // Safety gate: without confirm=true, just show preview
    if (!args.confirm) {
      return {
        content: [{
          type: "text" as const,
          text: [
            "--- EMAIL PREVIEW (not sent) ---",
            "",
            template,
            "",
            "--- END PREVIEW ---",
            "",
            "This email has NOT been sent. To send, call compose_email again with confirm=true.",
            "Ask the user to confirm before sending.",
          ].join("\n"),
        }],
      };
    }

    // Actually send
    try {
      await client.sendTemplate(template, args.account);
      return {
        content: [{
          type: "text" as const,
          text: `Email sent successfully to ${args.to}.`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error sending email: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });
}
