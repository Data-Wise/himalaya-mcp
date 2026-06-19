/**
 * Shared attachment utilities for MML template construction.
 * Used by compose_email and send_email tools.
 */

import { existsSync } from "node:fs";
import { basename, extname } from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/** Return the MIME type for a file path based on its extension. */
export function mimeTypeForPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Validate that all attachment paths exist on disk.
 * Returns an error message string if any path is missing, null if all are OK.
 */
export function validateAttachmentPaths(paths: string[]): string | null {
  for (const p of paths) {
    if (!existsSync(p)) {
      return `Attachment not found: "${p}"`;
    }
  }
  return null;
}

/**
 * Build MML <#part> sections for a list of file paths.
 * Appended after the email body — himalaya's MML parser resolves the
 * filename attributes into real MIME attachments when sending.
 */
export function buildAttachmentMml(paths: string[]): string {
  return paths
    .map((p) => {
      const name = basename(p);
      const type = mimeTypeForPath(p);
      return `<#part type=${type} name="${name}" filename="${p}" disposition=attachment>\n<#/part>`;
    })
    .join("\n");
}
