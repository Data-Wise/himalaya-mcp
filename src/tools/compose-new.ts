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
import { envelopeError } from "./_envelope.js";
import { validateAttachmentPaths, buildAttachmentMml } from "./_attachments.js";

/** Build an MML email template from parameters. */
function buildTemplate(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  from?: string,
  attachments?: string[],
): string {
  const headers: string[] = [];
  if (from) headers.push(`From: ${from}`);
  headers.push(`To: ${to}`);
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  headers.push(`Subject: ${subject}`);
  let result = headers.join("\n") + "\n\n" + body;
  if (attachments?.length) {
    result += "\n\n" + buildAttachmentMml(attachments);
  }
  return result;
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
      attachments: z.array(z.string()).optional().describe("Local file paths to attach (e.g. [\"/tmp/report.pdf\"])"),
      confirm: z.boolean().optional().describe("Set to true to actually send. Without this, only shows a preview."),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!EMAIL_RE.test(args.to)) {
      return {
        content: [{
          type: "text" as const,
          text: `Invalid email address "${args.to}". Must contain @.`,
        }],
        isError: true,
      };
    }

    if (!client.from) {
      return {
        content: [{
          type: "text" as const,
          text: "No sender address configured. Set HIMALAYA_FROM env var, or add `email = \"you@example.com\"` to your default account in ~/.config/himalaya/config.toml.",
        }],
        isError: true,
      };
    }

    // Validate attachment paths before building the template
    if (args.attachments?.length) {
      const err = validateAttachmentPaths(args.attachments);
      if (err) {
        return {
          content: [{ type: "text" as const, text: err }],
          isError: true,
        };
      }
    }

    const template = buildTemplate(args.to, args.subject, args.body, args.cc, args.bcc, client.from, args.attachments);

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
      return envelopeError(err);
    }
  });
}
