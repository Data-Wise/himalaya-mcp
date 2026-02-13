/**
 * MCP prompt: draft_reply
 *
 * Guides Claude to compose a professional reply to an email,
 * using draft_reply tool to generate the template and send_email to send.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerReplyPrompt(server: McpServer) {
  server.registerPrompt("draft_reply", {
    title: "Draft Reply",
    description: "Compose a professional reply to an email. Reads the original, generates a draft, and presents for review before sending.",
    argsSchema: {
      id: z.string().describe("Email message ID to reply to"),
      tone: z.string().optional().describe("Desired tone: professional, casual, brief, detailed (default: professional)"),
      instructions: z.string().optional().describe("Specific instructions for the reply content"),
    },
  }, async ({ id, tone, instructions }) => {
    const toneStr = tone || "professional";
    const instructionStr = instructions
      ? `\n\nSpecific instructions: ${instructions}`
      : "";

    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Help me reply to email ${id}:`,
              "",
              `1. Use read_email (id: "${id}") to understand the original message`,
              `2. Use draft_reply (id: "${id}") to generate the reply template`,
              "3. Compose a reply with these guidelines:",
              `   - Tone: ${toneStr}`,
              "   - Address all questions or points raised",
              "   - Keep it concise but complete",
              "   - Include appropriate greeting and sign-off",
              instructionStr,
              "",
              "4. Show me the complete draft and ask for my feedback",
              "5. Only use send_email with confirm=true after I explicitly approve",
              "",
              "IMPORTANT: Never send without my explicit approval.",
            ].join("\n"),
          },
        },
      ],
    };
  });
}
