/**
 * MCP tools for calendar integration: extract events from ICS attachments
 * and create Apple Calendar events.
 *
 * Uses downloadAttachments (bulk download) then scans for .ics files,
 * since himalaya CLI has no attachment list command.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseICSFile, createAppleCalendarEvent } from "../adapters/calendar.js";
import { mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";

export function registerCalendarTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("extract_calendar_event", {
    description: "Extract calendar event details from an email's ICS attachment. Downloads all attachments, finds the .ics file, parses it, and returns event summary, dates, location, and organizer.",
    inputSchema: {
      id: z.string().describe("Email message ID containing the calendar invite"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      // Step 1: Download all attachments
      const destDir = join(tmpdir(), `himalaya-mcp-${randomUUID()}`);
      await mkdir(destDir, { recursive: true });
      await client.downloadAttachments(args.id, destDir, args.folder, args.account);

      // Step 2: Scan for .ics files
      const entries = await readdir(destDir);
      const icsFile = entries.find((f) => extname(f).toLowerCase() === ".ics");

      if (!icsFile) {
        return {
          content: [{ type: "text" as const, text: `No calendar attachment (.ics) found in email ${args.id}.` }],
        };
      }

      // Step 3: Parse ICS
      const filePath = join(destDir, icsFile);
      const event = await parseICSFile(filePath);

      if (!event) {
        return {
          content: [{ type: "text" as const, text: "Error: Could not parse calendar event from ICS file." }],
          isError: true,
        };
      }

      // Step 4: Format output
      const lines = [
        `Event: ${event.summary}`,
        `Start: ${event.dtstart}`,
        `End: ${event.dtend}`,
      ];
      if (event.location) lines.push(`Location: ${event.location}`);
      if (event.organizer) lines.push(`Organizer: ${event.organizer}`);
      if (event.description) lines.push(`Description: ${event.description}`);
      lines.push("", "Use create_calendar_event to add this to Apple Calendar.");

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error extracting calendar event: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });

  server.registerTool("create_calendar_event", {
    description: "Create an event in Apple Calendar. SAFETY: requires confirm=true to actually create. Without confirm, returns a preview. macOS only.",
    inputSchema: {
      summary: z.string().describe("Event title/summary"),
      dtstart: z.string().describe("Start date/time (ISO format, e.g. '2026-02-16T09:00:00')"),
      dtend: z.string().describe("End date/time (ISO format)"),
      location: z.string().optional().describe("Event location"),
      description: z.string().optional().describe("Event description/notes"),
      confirm: z.boolean().optional().describe("Set to true to actually create. Without this, only shows a preview."),
    },
  }, async (args) => {
    // Safety gate
    if (!args.confirm) {
      const lines = [
        "--- CALENDAR EVENT PREVIEW (not created) ---",
        "",
        `Event: ${args.summary}`,
        `Start: ${args.dtstart}`,
        `End: ${args.dtend}`,
      ];
      if (args.location) lines.push(`Location: ${args.location}`);
      if (args.description) lines.push(`Description: ${args.description}`);
      lines.push(
        "",
        "--- END PREVIEW ---",
        "",
        "This event has NOT been created. To create, call create_calendar_event again with confirm=true.",
        "Ask the user to confirm before creating.",
      );

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }

    // Actually create
    try {
      await createAppleCalendarEvent({
        summary: args.summary,
        dtstart: args.dtstart,
        dtend: args.dtend,
        location: args.location,
        description: args.description,
      });

      return {
        content: [{
          type: "text" as const,
          text: `Calendar event "${args.summary}" created successfully in Apple Calendar.`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error creating calendar event: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });
}
