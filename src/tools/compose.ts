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
import { parseMessageBody } from "../himalaya/parser.js";

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
      const result = parseMessageBody(raw);

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
      return {
        content: [{
          type: "text" as const,
          text: `Error drafting reply: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });

  server.registerTool("send_email", {
    description: "Send an email template. SAFETY: requires confirm=true to actually send. Without confirm, returns a preview. Always show the user the preview and get their approval before sending with confirm=true.",
    inputSchema: {
      template: z.string().describe("The full email template (MML format with headers and body). Get this from draft_reply output."),
      confirm: z.boolean().optional().describe("Set to true to actually send. Without this, only shows a preview."),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    // Safety gate: without confirm=true, just show preview
    if (!args.confirm) {
      return {
        content: [{
          type: "text" as const,
          text: [
            "--- EMAIL PREVIEW (not sent) ---",
            "",
            args.template,
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
      await client.sendTemplate(args.template, args.account);
      return {
        content: [{
          type: "text" as const,
          text: "Email sent successfully.",
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
