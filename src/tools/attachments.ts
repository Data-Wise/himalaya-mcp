/**
 * MCP tools for email attachments: list and download.
 *
 * Since himalaya CLI only provides `attachment download <id>` (downloads ALL
 * attachments to cwd), both tools work by downloading everything to a temp
 * directory, then using fs operations to list/find specific files.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { mkdir, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname, basename } from "node:path";
import { randomUUID } from "node:crypto";

/** Body parts himalaya dumps alongside real attachments. */
const BODY_PART_NAMES = new Set(["plain.txt", "index.html"]);

/** Infer MIME type from file extension. */
function mimeFromExt(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".ics": "text/calendar",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
    ".ppt": "application/vnd.ms-powerpoint",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".zip": "application/zip",
    ".gz": "application/gzip",
    ".tar": "application/x-tar",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".html": "text/html",
    ".json": "application/json",
    ".xml": "application/xml",
    ".eml": "message/rfc822",
  };
  return map[ext] || "application/octet-stream";
}

/** Download all attachments to temp dir and return file info (excluding body parts). */
async function downloadAndList(
  client: HimalayaClient,
  id: string,
  folder?: string,
  account?: string,
): Promise<{ destDir: string; files: Array<{ filename: string; mime: string; size: number }> }> {
  const destDir = join(tmpdir(), `himalaya-mcp-${randomUUID()}`);
  await mkdir(destDir, { recursive: true });

  await client.downloadAttachments(id, destDir, folder, account);

  const entries = await readdir(destDir);
  const files: Array<{ filename: string; mime: string; size: number }> = [];

  for (const entry of entries) {
    // Filter out body parts
    if (BODY_PART_NAMES.has(entry)) continue;

    const info = await stat(join(destDir, entry));
    if (!info.isFile()) continue;

    // Skip tiny files with generic names (likely body part variants)
    if (info.size < 100 && !extname(entry)) continue;

    files.push({
      filename: entry,
      mime: mimeFromExt(entry),
      size: info.size,
    });
  }

  return { destDir, files };
}

export function registerAttachmentTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("list_attachments", {
    description: "List attachments for an email message. Downloads all attachments to inspect them, then returns filename, MIME type (inferred from extension), and size for each.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const { files } = await downloadAndList(client, args.id, args.folder, args.account);

      if (files.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No attachments found for email ${args.id}.` }],
        };
      }

      const lines = files.map((a) => {
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
    description: "Download an email attachment to a temporary directory. Downloads all attachments, then returns the path to the requested file.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      filename: z.string().describe("Attachment filename to download"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    // Guard against path traversal in user-provided filename
    if (basename(args.filename) !== args.filename) {
      return {
        content: [{
          type: "text" as const,
          text: `Invalid filename "${args.filename}". Filename must not contain path separators.`,
        }],
        isError: true,
      };
    }

    try {
      const { destDir, files } = await downloadAndList(client, args.id, args.folder, args.account);

      const match = files.find((f) => f.filename === args.filename);
      if (!match) {
        const available = files.map((f) => f.filename).join(", ");
        return {
          content: [{
            type: "text" as const,
            text: `Attachment "${args.filename}" not found in email ${args.id}. Available: ${available || "none"}`,
          }],
          isError: true,
        };
      }

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
