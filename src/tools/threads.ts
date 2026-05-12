/**
 * MCP tools for thread/conversation view.
 *
 * list_threads — Group emails into conversation threads
 * read_thread  — Read all messages in a thread chronologically
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseEnvelopes, parseMessageBody } from "../himalaya/parser.js";
import { groupIntoThreads, formatThread } from "../himalaya/thread-parser.js";
import { envelopeError } from "./_envelope.js";

export function registerThreadTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("list_threads", {
    description:
      "List email threads (conversations) in a folder. Groups related emails by subject line. " +
      "Returns threads sorted by most recent activity, with participant list and message count.",
    inputSchema: {
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      page_size: z
        .number()
        .optional()
        .describe("Number of emails to fetch for grouping (default: 50)"),
      page: z.number().optional().describe("Page number for pagination"),
      account: z
        .string()
        .optional()
        .describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const pageSize = args.page_size ?? 50;
      const raw = await client.listEnvelopes(
        args.folder,
        pageSize,
        args.page,
        args.account,
      );
      const result = parseEnvelopes(raw);

      if (!result.ok) {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }

      const threads = groupIntoThreads(result.data);
      const summary = threads.map(formatThread).join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${threads.length} threads (from ${result.data.length} emails):\n\n${summary}`,
          },
        ],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });

  server.registerTool("read_thread", {
    description:
      "Read all messages in a conversation thread. Given a thread_id (the ID of the first " +
      "message), fetches all related messages and returns them in chronological order. " +
      "Use list_threads first to get thread IDs.",
    inputSchema: {
      thread_id: z
        .string()
        .describe(
          "ID of the thread's first message (from list_threads output)",
        ),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z
        .string()
        .optional()
        .describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      // Fetch envelopes to find the thread
      const raw = await client.listEnvelopes(args.folder, 50, undefined, args.account);
      const result = parseEnvelopes(raw);

      if (!result.ok) {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }

      const threads = groupIntoThreads(result.data);
      const thread = threads.find((t) => t.thread_id === args.thread_id);

      if (!thread) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Thread not found with id "${args.thread_id}". Use list_threads to see available threads.`,
            },
          ],
          isError: true,
        };
      }

      // Read each message body in the thread
      const messageBodies: string[] = [];
      for (const msg of thread.messages) {
        const bodyRaw = await client.readMessage(msg.id, args.folder, args.account);
        const bodyResult = parseMessageBody(bodyRaw);
        const body = bodyResult.ok ? bodyResult.data : "[Error reading message]";

        const from = msg.from.name
          ? `${msg.from.name} <${msg.from.addr}>`
          : msg.from.addr;
        messageBodies.push(
          `--- Message ${msg.id} ---\nFrom: ${from}\nDate: ${msg.date}\n\n${body}`,
        );
      }

      const header = `Thread: ${thread.subject} (${thread.message_count} messages)\n` +
        `Participants: ${thread.participants.map((p) => p.name || p.addr).join(", ")}\n`;

      return {
        content: [
          {
            type: "text" as const,
            text: `${header}\n${messageBodies.join("\n\n")}`,
          },
        ],
      };
    } catch (err) {
      return envelopeError(err);
    }
  });
}
