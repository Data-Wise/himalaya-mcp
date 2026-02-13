/**
 * MCP resources for browsing email data.
 *
 * Resources provide a read-only view that Claude can browse:
 * - email://inbox — current inbox listing
 * - email://message/{id} — specific message body
 * - email://folders — available folders
 */

import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HimalayaClient } from "../himalaya/client.js";
import { parseEnvelopes, parseFolders, parseMessageBody, formatEnvelope } from "../himalaya/parser.js";

export function registerResources(server: McpServer, client: HimalayaClient) {
  // email://inbox — current inbox listing
  server.registerResource("inbox", "email://inbox", {
    description: "Current inbox email listing",
    mimeType: "text/plain",
  }, async () => {
    try {
      const raw = await client.listEnvelopes();
      const result = parseEnvelopes(raw);

      if (!result.ok) {
        return { contents: [{ uri: "email://inbox", text: `Error: ${result.error}` }] };
      }

      const text = result.data.map(formatEnvelope).join("\n");

      return {
        contents: [{
          uri: "email://inbox",
          text: `Inbox (${result.data.length} emails):\n\n${text}`,
        }],
      };
    } catch (err) {
      return { contents: [{ uri: "email://inbox", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  });

  // email://folders — list of available folders
  server.registerResource("folders", "email://folders", {
    description: "Available email folders",
    mimeType: "text/plain",
  }, async () => {
    try {
      const raw = await client.listFolders();
      const result = parseFolders(raw);

      if (!result.ok) {
        return { contents: [{ uri: "email://folders", text: `Error: ${result.error}` }] };
      }

      const text = result.data.map((f) => `${f.name} — ${f.desc}`).join("\n");

      return {
        contents: [{
          uri: "email://folders",
          text: `Folders (${result.data.length}):\n\n${text}`,
        }],
      };
    } catch (err) {
      return { contents: [{ uri: "email://folders", text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  });

  // email://message/{id} — specific message body
  const messageTemplate = new ResourceTemplate("email://message/{id}", {
    list: undefined,
  });

  server.registerResource("message", messageTemplate, {
    description: "Read a specific email message by ID",
    mimeType: "text/plain",
  }, async (uri, params) => {
    try {
      const id = String(params.id);
      const raw = await client.readMessage(id);
      const result = parseMessageBody(raw);

      if (!result.ok) {
        return { contents: [{ uri: uri.href, text: `Error: ${result.error}` }] };
      }

      return {
        contents: [{
          uri: uri.href,
          text: result.data || "(empty message body)",
        }],
      };
    } catch (err) {
      return { contents: [{ uri: uri.href, text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  });
}
