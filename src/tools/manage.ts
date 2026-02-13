/**
 * MCP tools for managing emails: flagging and moving.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";

export function registerManageTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("flag_email", {
    description: "Add or remove flags on an email. Common flags: Seen, Flagged, Answered, Deleted, Draft. Use 'add' to set flags, 'remove' to clear them.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      flags: z.array(z.string()).describe("Flags to add/remove (e.g. ['Seen', 'Flagged'])"),
      action: z.enum(["add", "remove"]).describe("Whether to add or remove the flags"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      await client.flagMessage(args.id, args.flags, args.action, args.folder, args.account);
      const verb = args.action === "add" ? "Added" : "Removed";
      return {
        content: [{
          type: "text" as const,
          text: `${verb} flags [${args.flags.join(", ")}] on email ${args.id}`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error flagging email: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });

  server.registerTool("move_email", {
    description: "Move an email to a different folder. Common targets: Archive, Trash, Spam, Sent, Drafts.",
    inputSchema: {
      id: z.string().describe("Email message ID"),
      target_folder: z.string().describe("Destination folder name (e.g. 'Archive', 'Trash')"),
      folder: z.string().optional().describe("Source folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      await client.moveMessage(args.id, args.target_folder, args.folder, args.account);
      return {
        content: [{
          type: "text" as const,
          text: `Moved email ${args.id} to ${args.target_folder}`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error moving email: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });
}
