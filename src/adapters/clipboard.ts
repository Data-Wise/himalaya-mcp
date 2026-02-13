/**
 * Clipboard adapter — copy text to system clipboard.
 *
 * Uses pbcopy (macOS) or xclip (Linux). Useful for copying
 * email bodies, markdown exports, or any text to clipboard.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const execFileAsync = promisify(execFile);

/** Detect the clipboard command for the current platform. */
function getClipboardCommand(): { cmd: string; args: string[] } | null {
  switch (process.platform) {
    case "darwin":
      return { cmd: "pbcopy", args: [] };
    case "linux":
      return { cmd: "xclip", args: ["-selection", "clipboard"] };
    default:
      return null;
  }
}

/** Copy text to system clipboard. */
export async function copyToClipboard(text: string): Promise<void> {
  const clip = getClipboardCommand();
  if (!clip) {
    throw new Error(`Clipboard not supported on platform: ${process.platform}`);
  }

  const child = execFileAsync(clip.cmd, clip.args, {
    timeout: 5_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  // Write text to stdin
  child.child.stdin?.write(text);
  child.child.stdin?.end();

  await child;
}

export function registerClipboardTools(server: McpServer) {
  server.registerTool("copy_to_clipboard", {
    description: "Copy text to the system clipboard (pbcopy on macOS, xclip on Linux). Useful for copying email content, markdown exports, or any text.",
    inputSchema: {
      text: z.string().describe("Text to copy to clipboard"),
    },
  }, async (args) => {
    try {
      await copyToClipboard(args.text);
      const preview = args.text.length > 100
        ? args.text.slice(0, 100) + "..."
        : args.text;
      return {
        content: [{
          type: "text" as const,
          text: `Copied to clipboard (${args.text.length} chars):\n${preview}`,
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text" as const,
          text: `Error copying to clipboard: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });
}
