/**
 * read_email_raw MCP tool.
 *
 * Returns the raw MIME source of an email using himalaya's
 * `message export --full` command, which exports the raw,
 * unedited message as a .eml file.
 */

import { z } from "zod/v4";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { envelopeError } from "./_envelope.js";

const execFileAsync = promisify(execFile);

export function registerReadRawTools(server: McpServer, client: HimalayaClient) {
  server.registerTool("read_email_raw", {
    description: "Read the raw MIME source of an email. Returns the full, unedited message including all headers. Useful for debugging, email forensics, and exporting to .eml format.",
    inputSchema: {
      id: z.coerce.string().describe("Email message ID"),
      folder: z.string().optional().describe("Folder name (default: INBOX)"),
      account: z.string().optional().describe("Account name (uses default if omitted)"),
    },
  }, async (args) => {
    const tmpDir = mkdtempSync(join(tmpdir(), "himalaya-mcp-raw-"));
    const emlPath = join(tmpDir, `${args.id}.eml`);
    try {
      const binary = client.binary;

      // Build the export command: export --full --destination <path> <id>
      const cmdArgs: string[] = ["message", "export", "--full", "--destination", emlPath];
      const account = args.account || client.account || "";
      if (account) cmdArgs.push("--account", account);
      cmdArgs.push(args.id);

      await execFileAsync(binary, cmdArgs, { timeout: 30_000 });

      const raw = readFileSync(emlPath, "utf-8");
      return {
        content: [{ type: "text" as const, text: raw }],
      };
    } catch (err) {
      return envelopeError(err);
    } finally {
      try { rmSync(tmpDir, { recursive: true }); } catch { /* ignore cleanup errors */ }
    }
  });
}
