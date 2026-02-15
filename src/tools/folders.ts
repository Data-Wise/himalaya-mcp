/**
 * MCP tools for folder management: list, create, delete.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseFolders } from "../himalaya/parser.js";

export function registerFolderTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("list_folders", {
    description: "List all email folders/mailboxes for an account. Returns folder names.",
    inputSchema: {
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      const raw = await client.listFolders(args.account);
      const result = parseFolders(raw);
      if (!result.ok) {
        return {
          content: [{ type: "text" as const, text: `Error listing folders: ${result.error}` }],
          isError: true,
        };
      }
      const lines = result.data.map((f) => `- ${f.name}${f.desc ? ` (${f.desc})` : ""}`);
      return {
        content: [{ type: "text" as const, text: lines.length > 0 ? lines.join("\n") : "No folders found." }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error listing folders: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("create_folder", {
    description: "Create a new email folder/mailbox.",
    inputSchema: {
      name: z.string().describe("Name for the new folder"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    try {
      await client.createFolder(args.name, args.account);
      return {
        content: [{ type: "text" as const, text: `Folder "${args.name}" created successfully.` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error creating folder: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });

  server.registerTool("delete_folder", {
    description: "Delete an email folder/mailbox. SAFETY: requires confirm=true to actually delete. Without confirm, returns a preview warning.",
    inputSchema: {
      name: z.string().describe("Name of the folder to delete"),
      confirm: z.boolean().optional().describe("Set to true to actually delete. Without this, only shows a preview warning."),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    // Safety gate: without confirm=true, just show warning
    if (!args.confirm) {
      return {
        content: [{
          type: "text" as const,
          text: [
            "--- DELETE FOLDER PREVIEW ---",
            "",
            `Folder to delete: ${args.name}`,
            "",
            "WARNING: This will permanently delete the folder and all emails in it.",
            "",
            "--- END PREVIEW ---",
            "",
            "This folder has NOT been deleted. To delete, call delete_folder again with confirm=true.",
            "Ask the user to confirm before deleting.",
          ].join("\n"),
        }],
      };
    }

    try {
      await client.deleteFolder(args.name, args.account);
      return {
        content: [{ type: "text" as const, text: `Folder "${args.name}" deleted successfully.` }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error deleting folder: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });
}
