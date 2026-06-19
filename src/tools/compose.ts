/**
 * MCP tools for composing and sending emails.
 *
 * Safety gate design:
 * - draft_reply generates a template (preview only, no send)
 * - send_email requires explicit confirm=true to actually send
 * - Without confirm, send_email returns a preview for user review
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseTemplate } from "../himalaya/parser.js";
import { envelopeError } from "./_envelope.js";
import { validateAttachmentPaths, buildAttachmentMml } from "./_attachments.js";

export function registerComposeTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("draft_reply", {
    description: "Generate a reply draft for an email. Returns the reply template with headers and quoted original message. Does NOT send — use send_email to send after user reviews.",
    inputSchema: {
      id: z.string().describe("Email message ID to reply to"),
      body: z.string().optional().describe("Custom reply body text (prepended to quoted original)"),
      reply_all: z.boolean().optional().describe("Reply to all recipients (default: false)"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const raw = await client.replyTemplate(
        args.id,
        args.body,
        args.reply_all,
        args.folder,
        args.account,
      );
      const result = parseTemplate(raw);

      if (!result.ok) {
        return {
          content: [{ type: "text" as const, text: `Error generating reply template: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: "text" as const,
          text: [
            "--- DRAFT REPLY (not sent) ---",
            "",
            result.data,
            "",
            "--- END DRAFT ---",
            "",
            "Review the draft above. To send, use send_email with the template text and confirm=true.",
          ].join("\n"),
        }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });

  server.registerTool("send_email", {
    description: "Send an email template. SAFETY: requires confirm=true to actually send. Without confirm, returns a preview. Always show the user the preview and get their approval before sending with confirm=true.",
    inputSchema: {
      template: z.string().describe("The full email template (MML format with headers and body). Get this from draft_reply output."),
      attachments: z.array(z.string()).optional().describe("Local file paths to attach (e.g. [\"/tmp/report.pdf\"])"),
      confirm: z.boolean().optional().describe("Set to true to actually send. Without this, only shows a preview."),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    // Validate attachment paths before showing preview or sending
    if (args.attachments?.length) {
      const err = validateAttachmentPaths(args.attachments);
      if (err) {
        return {
          content: [{ type: "text" as const, text: err }],
          isError: true,
        };
      }
    }

    // Inject attachment MML parts into the template (after headers+body)
    const template = args.attachments?.length
      ? args.template + "\n\n" + buildAttachmentMml(args.attachments)
      : args.template;

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
            "This email has NOT been sent. To send, call send_email again with confirm=true.",
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
          text: "Email sent successfully.",
        }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
