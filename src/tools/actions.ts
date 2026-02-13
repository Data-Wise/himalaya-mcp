/**
 * MCP tools for email actions: export to markdown, extract action items.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseEnvelopes, parseMessageBody } from "../himalaya/parser.js";

export function registerActionTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("export_to_markdown", {
    description: "Export an email as formatted markdown with YAML frontmatter (date, from, to, subject, flags). Returns the markdown text — you can then save it to a file or clipboard.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      // Fetch envelope for metadata
      const envelopeRaw = await client.listEnvelopes(args.folder, 50);
      const envelopeResult = parseEnvelopes(envelopeRaw);

      if (!envelopeResult.ok) {
        return {
          content: [{ type: "text" as const, text: `Error fetching envelope: ${envelopeResult.error}` }],
          isError: true,
        };
      }

      const envelope = envelopeResult.data.find((e) => e.id === args.id);
      if (!envelope) {
        return {
          content: [{ type: "text" as const, text: `Email ${args.id} not found in folder` }],
          isError: true,
        };
      }

      // Fetch body
      const bodyRaw = await client.readMessage(args.id, args.folder);
      const bodyResult = parseMessageBody(bodyRaw);

      if (!bodyResult.ok) {
        return {
          content: [{ type: "text" as const, text: `Error reading email body: ${bodyResult.error}` }],
          isError: true,
        };
      }

      // Build markdown
      const fromStr = envelope.from.name
        ? `${envelope.from.name} <${envelope.from.addr}>`
        : envelope.from.addr;
      const toStr = envelope.to.name
        ? `${envelope.to.name} <${envelope.to.addr}>`
        : envelope.to.addr;

      const md = [
        "---",
        `subject: "${envelope.subject.replace(/"/g, '\\"')}"`,
        `from: "${fromStr}"`,
        `to: "${toStr}"`,
        `date: "${envelope.date}"`,
        `id: "${envelope.id}"`,
        envelope.flags.length > 0 ? `flags: [${envelope.flags.join(", ")}]` : "flags: []",
        envelope.has_attachment ? "has_attachment: true" : "has_attachment: false",
        "---",
        "",
        `# ${envelope.subject}`,
        "",
        bodyResult.data || "(empty body)",
      ].join("\n");

      return {
        content: [{ type: "text" as const, text: md }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error exporting email: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });

  server.registerTool("create_action_item", {
    description: "Read an email and extract action items, todos, deadlines, and commitments. Returns structured action items that can be used to create tasks, reminders, or calendar events.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      // Fetch envelope for context
      const envelopeRaw = await client.listEnvelopes(args.folder, 50);
      const envelopeResult = parseEnvelopes(envelopeRaw);

      let subject = "(unknown subject)";
      let from = "(unknown sender)";
      let date = "(unknown date)";

      if (envelopeResult.ok) {
        const envelope = envelopeResult.data.find((e) => e.id === args.id);
        if (envelope) {
          subject = envelope.subject;
          from = envelope.from.name || envelope.from.addr;
          date = envelope.date;
        }
      }

      // Fetch body
      const bodyRaw = await client.readMessage(args.id, args.folder);
      const bodyResult = parseMessageBody(bodyRaw);

      if (!bodyResult.ok) {
        return {
          content: [{ type: "text" as const, text: `Error reading email: ${bodyResult.error}` }],
          isError: true,
        };
      }

      // Return email context for Claude to extract action items
      return {
        content: [{
          type: "text" as const,
          text: [
            "Extract action items from this email:",
            "",
            `**Subject:** ${subject}`,
            `**From:** ${from}`,
            `**Date:** ${date}`,
            "",
            "**Body:**",
            bodyResult.data || "(empty body)",
            "",
            "---",
            "",
            "Please identify:",
            "- [ ] Action items / tasks",
            "- [ ] Deadlines or due dates",
            "- [ ] Commitments made by sender",
            "- [ ] Questions that need answers",
            "- [ ] Meetings or events mentioned",
          ].join("\n"),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error extracting actions: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });
}
