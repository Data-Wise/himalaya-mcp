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
import { addresses, buildMessage, parseMessage, renderForReview, templateToMessage } from "../himalaya/message.js";
import { formatFromHeader, resolveDisplayName } from "../himalaya/config-toml.js";

/**
 * Reply-all recipients for himalaya v2, which has no --all: everyone on the
 * original To and Cc, minus the replying account and whoever the reply
 * already goes to.
 */
export function replyAllCc(original: Awaited<ReturnType<typeof parseMessage>>, self: string): string[] {
  const exclude = new Set([
    self.toLowerCase(),
    ...addresses(original.replyTo?.length ? original.replyTo : original.from ? [original.from] : []),
  ]);
  const seen = new Set<string>();
  return [...addresses(original.to), ...addresses(original.cc)].filter((a) => {
    if (exclude.has(a) || seen.has(a)) return false;
    seen.add(a);
    return true;
  });
}

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
      if ((await client.resolveVersion()).major >= 2) {
        // v2 prints the composed reply as raw RFC 5322 (quoted-printable
        // body); decode it into a readable template send_email accepts back.
        const self = client.fromForAccount(args.account);
        const cc = args.reply_all
          ? replyAllCc(await parseMessage(await client.readRawMessage(args.id, args.folder, args.account)), self)
          : [];
        const raw = await client.replyRaw(args.id, args.body, cc, args.folder, args.account);
        return {
          content: [{
            type: "text" as const,
            text: [
              "--- DRAFT REPLY (not sent) ---",
              "",
              renderForReview(await parseMessage(raw)),
              "",
              "--- END DRAFT ---",
              "",
              "Review the draft above. To send, use send_email with the template text and confirm=true.",
            ].join("\n"),
          }],
        };
      }

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

    const v2 = (await client.resolveVersion()).major >= 2;

    // Inject attachment MML parts into the template (after headers+body).
    // v2 has no MML, so there the preview lists them instead.
    const template = args.attachments?.length
      ? args.template + "\n\n" + (v2
        ? "Attachments:\n" + args.attachments.map((p) => `- ${p}`).join("\n")
        : buildAttachmentMml(args.attachments))
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
      if (v2) {
        // v2 has no MML: rebuild the reviewed template as a real message,
        // threading headers and attachments included, and keep a sent copy.
        const address = client.fromForAccount(args.account);
        const message = await templateToMessage(args.template, {
          from: formatFromHeader(address, resolveDisplayName(args.account || client.account)),
        });
        message.attachments = args.attachments;
        await client.sendRaw(await buildMessage(message), "sent", args.account);
      } else {
        await client.sendTemplate(template, args.account);
      }
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
