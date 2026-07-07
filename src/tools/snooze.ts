/**
 * snooze_email + list_snoozed_emails MCP tools.
 *
 * Snooze persistence via local JSON file at ~/.himalaya-mcp/snooze.json.
 * Cross-platform (no macOS dependency).
 */

import { z } from "zod/v4";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { envelopeError } from "./_envelope.js";

interface SnoozeEntry {
  id: string;
  folder: string;
  account: string;
  subject: string;
  snoozeUntil: string;
  createdAt: string;
}

const SNOOZE_DIR = join(homedir(), ".himalaya-mcp");
const SNOOZE_PATH = join(SNOOZE_DIR, "snooze.json");

function readSnoozed(): SnoozeEntry[] {
  if (!existsSync(SNOOZE_PATH)) return [];
  try {
    return JSON.parse(readFileSync(SNOOZE_PATH, "utf-8")) as SnoozeEntry[];
  } catch {
    return [];
  }
}

function writeSnoozed(entries: SnoozeEntry[]): void {
  mkdirSync(SNOOZE_DIR, { recursive: true });
  writeFileSync(SNOOZE_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8");
}

export function registerSnoozeTools(server: McpServer) {
  server.registerTool("snooze_email", {
    description: "Snooze an email until a specified time. The email will reappear in your inbox check after the snooze period expires.",
    inputSchema: {
      id: z.string().describe("Email message ID to snooze"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name"),
      subject: z.string().optional().describe("Email subject (for display)"),
      snoozeUntil: z.string().describe("When to unsnooze (ISO format, e.g. 2026-07-08T09:00:00, or shorthand: '2h', '1d', 'tomorrow', 'monday')"),
    },
  }, async (args) => {
    try {
      // Parse shorthand time formats
      let until = args.snoozeUntil;
      const now = new Date();
      const lower = until.toLowerCase();
      if (lower === "tomorrow") {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        until = d.toISOString();
      } else if (lower === "monday") {
        const d = new Date(now);
        const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
        d.setDate(d.getDate() + daysUntilMonday);
        d.setHours(9, 0, 0, 0);
        until = d.toISOString();
      } else if (lower.endsWith("h")) {
        const hours = parseInt(lower, 10);
        if (!isNaN(hours)) {
          const d = new Date(now);
          d.setHours(d.getHours() + hours);
          until = d.toISOString();
        }
      } else if (lower.endsWith("d")) {
        const days = parseInt(lower, 10);
        if (!isNaN(days)) {
          const d = new Date(now);
          d.setDate(d.getDate() + days);
          until = d.toISOString();
        }
      }

      const entries = readSnoozed();
      entries.push({
        id: args.id,
        folder: args.folder || "INBOX",
        account: args.account || "",
        subject: args.subject || `Email #${args.id}`,
        snoozeUntil: until,
        createdAt: now.toISOString(),
      });
      writeSnoozed(entries);

      return {
        content: [{ type: "text" as const, text: `Email #${args.id} snoozed until ${until}` }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });

  server.registerTool("list_snoozed_emails", {
    description: "List all snoozed emails and their unsnooze times. Emails past their snooze time are returned as expired and can be revisited.",
    inputSchema: {},
  }, async () => {
    try {
      const entries = readSnoozed();
      const now = new Date();
      const active = entries.filter((e) => new Date(e.snoozeUntil) > now);
      const expired = entries.filter((e) => new Date(e.snoozeUntil) <= now);

      const lines: string[] = [];
      if (active.length === 0 && expired.length === 0) {
        lines.push("No snoozed emails.");
      }
      if (active.length > 0) {
        lines.push("**Active snoozes:**");
        for (const e of active) {
          lines.push(`- #${e.id} "${e.subject}" — until ${e.snoozeUntil} (${e.folder}${e.account ? `, ${e.account}` : ""})`);
        }
      }
      if (expired.length > 0) {
        lines.push("");
        lines.push("**Expired snoozes (ready to revisit):**");
        for (const e of expired) {
          lines.push(`- #${e.id} "${e.subject}" — expired ${e.snoozeUntil}`);
        }
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
