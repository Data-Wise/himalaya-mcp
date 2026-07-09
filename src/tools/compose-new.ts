/**
 * MCP tool for composing new emails (not replies).
 *
 * Uses the same two-phase safety gate as send_email:
 * - Without confirm=true: returns a preview
 * - With confirm=true: actually sends via himalaya
 *
 * Supports HTML email bodies: when the body contains HTML (auto-detected
 * or explicitly set via html=true), it wraps the content in an MML
 * <#part type="text/html"> block so the email is sent with proper
 * Content-Type: text/html header.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { envelopeError } from "./_envelope.js";
import { validateAttachmentPaths, buildAttachmentMml } from "./_attachments.js";

/** Detect whether a string contains HTML content. */
function isHtmlContent(body: string): boolean {
  const trimmed = body.trim();
  return /^<!DOCTYPE\s+html/i.test(trimmed)
    || /^<html[\s>]/i.test(trimmed)
    || /<(html|head|body|div|table|p\b|h[1-6]\b|a\s|img\b|span\b|style\b|script\b|meta\b|link\b)/i.test(trimmed);
}

/** Build an MML email template from parameters. */
function buildTemplate(
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  from?: string,
  attachments?: string[],
  html?: boolean,
): string {
  const headers: string[] = [];
  if (from) headers.push(`From: ${from}`);
  headers.push(`To: ${to}`);
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  headers.push(`Subject: ${subject}`);

  let result = headers.join("\n") + "\n\n";

  const useHtml = html === true || isHtmlContent(body);

  if (useHtml) {
    // HTML-only: no text/plain fallback (himalaya's MML parser does not
    // produce correct multipart/alternative with both parts).
    result += `<#part type="text/html">\n${body}\n<#/part>`;
  } else {
    result += body;
  }

  if (attachments?.length) {
    result += "\n\n" + buildAttachmentMml(attachments);
  }
  return result;
}

export function registerComposeNewTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("compose_email", {
    description: "Compose and send a new email (not a reply). SAFETY: requires confirm=true to actually send. Without confirm, returns a preview for user review. HTML content is auto-detected; use html=true for explicit control.",
    inputSchema: {
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body text (plain text or HTML — auto-detected)"),
      cc: z.string().optional().describe("CC recipient(s)"),
      bcc: z.string().optional().describe("BCC recipient(s)"),
      html: z.boolean().optional().describe("Set to true to force HTML content type. Auto-detected when body contains HTML tags."),
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

    const template = buildTemplate(args.to, args.subject, args.body, args.cc, args.bcc, from, args.attachments, args.html);

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
