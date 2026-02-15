/**
 * MCP tools for email attachments: list and download.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export function registerAttachmentTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("list_attachments", {
    description: "List attachments for an email message. Returns filename, MIME type, and size for each attachment.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const raw = await client.listAttachments(args.id, args.folder, args.account);
      let attachments: Array<{ filename: string; mime: string; size: number }>;
      try {
        attachments = JSON.parse(raw);
      } catch {
        attachments = [];
      }

      if (attachments.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No attachments found for email ${args.id}.` }],
        };
      }

      const lines = attachments.map((a) => {
        const sizeKB = Math.round(a.size / 1024);
        return `- ${a.filename} (${a.mime}, ${sizeKB} KB)`;
      });

      return {
        content: [{
          type: "text" as const,
          text: `Attachments for email ${args.id}:\n${lines.join("\n")}`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error listing attachments: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });

  server.registerTool("download_attachment", {
    description: "Download an email attachment to a temporary directory. Returns the file path where the attachment was saved.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      filename: z.string().describe("Attachment filename to download"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      // Create unique temp directory
      const destDir = join(tmpdir(), `himalaya-mcp-${randomUUID()}`);
      await mkdir(destDir, { recursive: true });

      await client.downloadAttachment(args.id, args.filename, destDir, args.folder, args.account);

      const filePath = join(destDir, args.filename);

      return {
        content: [{
          type: "text" as const,
          text: `Downloaded "${args.filename}" to: ${filePath}`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error downloading attachment: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });
}
