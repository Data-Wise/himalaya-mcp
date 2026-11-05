/**
 * MCP tool for composing new emails (not replies).
 *
 * Uses the same two-phase safety gate as send_email:
 * - Without confirm=true: returns a preview
 * - With confirm=true: actually sends via himalaya
 * - With save_draft=true: saves to the drafts mailbox, never sends
 *   (himalaya v2 only)
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { envelopeError } from "./_envelope.js";
import { validateAttachmentPaths, buildAttachmentMml } from "./_attachments.js";
import { buildMessage } from "../himalaya/message.js";
import { formatFromHeader, resolveDisplayName } from "../himalaya/config-toml.js";

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
    description: "Compose and send a new email (not a reply). SAFETY: requires confirm=true to actually send. Without confirm, returns a preview for user review. With save_draft=true, saves the message (attachments included) to the drafts mailbox instead of sending: no confirm needed, nothing is sent (requires himalaya v2).",
    inputSchema: {
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body text"),
      cc: z.string().optional().describe("CC recipient(s)"),
      bcc: z.string().optional().describe("BCC recipient(s)"),
      attachments: z.array(z.string()).optional().describe("Local file paths to attach (e.g. [\"/tmp/report.pdf\"])"),
      confirm: z.boolean().optional().describe("Set to true to actually send. Without this, only shows a preview."),
      save_draft: z.boolean().optional().describe("Save to the drafts mailbox instead of sending. Takes precedence over confirm: nothing is sent. Requires himalaya v2."),
      drafts_folder: z.string().optional().describe("Mailbox (or alias) for save_draft (default: the account's drafts alias)"),
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

    const from = client.fromForAccount(args.account);
    if (!from) {
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

    const template = buildTemplate(args.to, args.subject, args.body, args.cc, args.bcc, from, args.attachments);
    const v2 = (await client.resolveVersion()).major >= 2;
    // v2 sends and saves finished RFC 5322 messages, built here.
    const buildRaw = () =>
      buildMessage({
        from: formatFromHeader(from, resolveDisplayName(args.account || client.account)),
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        subject: args.subject,
        text: args.body,
        attachments: args.attachments,
      });

    // Draft: saved, never sent, so it needs no confirm gate. The flags ride
    // on the APPEND itself; some servers refuse a later STORE of \Draft.
    if (args.save_draft) {
      if (!v2) {
        return {
          content: [{ type: "text" as const, text: "save_draft requires himalaya v2 (himalaya v1 is no longer developed)." }],
          isError: true,
        };
      }
      const mailbox = args.drafts_folder || "drafts";
      try {
        const id = await client.addRaw(await buildRaw(), mailbox, ["draft", "seen"], args.account);
        const attached = args.attachments?.length ? ` with ${args.attachments.length} attachment(s)` : "";
        return {
          content: [{
            type: "text" as const,
            text: `Draft saved to ${mailbox} (id ${id})${attached}. It has NOT been sent.`,
          }],
        };
      } catch (err) {
        return envelopeError(err);
      }
    }

    // v2 has no MML: preview the attachments as a plain list.
    const preview = v2
      ? buildTemplate(args.to, args.subject, args.body, args.cc, args.bcc, from) +
        (args.attachments?.length ? "\n\nAttachments:\n" + args.attachments.map((p) => `- ${p}`).join("\n") : "")
      : template;

    // Safety gate: without confirm=true, just show preview
    if (!args.confirm) {
      return {
        content: [{
          type: "text" as const,
          text: [
            "--- EMAIL PREVIEW (not sent) ---",
            "",
            preview,
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
      if (v2) {
        // v2 keeps no sent copy unless asked to.
        await client.sendRaw(await buildRaw(), "sent", args.account);
      } else {
        await client.sendTemplate(template, args.account);
      }
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
