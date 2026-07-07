/**
 * create_reminder MCP tool.
 *
 * Creates a reminder in Apple Reminders.app (macOS only) for
 * action items, follow-ups, or tasks extracted from email.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createReminder } from "../adapters/reminders.js";
import { envelopeError } from "./_envelope.js";

export function registerReminderTools(server: McpServer) {
  server.registerTool("create_reminder", {
    description: "Create a reminder in Apple Reminders (macOS only). Use for action items, follow-ups, and tasks extracted from email.",
    inputSchema: {
      title: z.string().describe("Reminder title / task description"),
      notes: z.string().optional().describe("Optional notes or context for the reminder"),
      dueDate: z.string().optional().describe("Optional due date (ISO format, e.g. 2026-07-15T14:00:00)"),
      priority: z.number().optional().describe("Priority 1-5 (1=highest)"),
    },
  }, async (args) => {
    if (process.platform !== "darwin") {
      return {
        content: [{ type: "text" as const, text: "Apple Reminders is only available on macOS." }],
        isError: true,
      };
    }
    try {
      await createReminder({
        title: args.title,
        notes: args.notes,
        dueDate: args.dueDate,
        priority: args.priority,
      });
      return {
        content: [{ type: "text" as const, text: `Reminder created: ${args.title}` }],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
