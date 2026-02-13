/**
 * Dogfooding tests — simulate realistic Claude usage patterns.
 *
 * These test the full tool registration → handler → output pipeline
 * using a mocked HimalayaClient, verifying that MCP tool responses
 * are useful and well-formatted for Claude.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { registerInboxTools } from "../src/tools/inbox.js";
import { registerReadTools } from "../src/tools/read.js";

// --- Sample data matching real himalaya output ---

const SAMPLE_ENVELOPES = JSON.stringify([
  {
    id: "249116",
    flags: ["Seen"],
    subject: "Receipt from Heatwave Coffee",
    from: { name: "Heatwave Coffee", addr: "messenger@squareup.com" },
    to: { name: null, addr: "user@example.com" },
    date: "2026-02-13 10:29",
    has_attachment: false,
  },
  {
    id: "249088",
    flags: [],
    subject: "Reminder - Seminar Today",
    from: { name: "Megan McKay", addr: "mmckay@unm.edu" },
    to: { name: null, addr: "dept@list.unm.edu" },
    date: "2026-02-13 09:05",
    has_attachment: false,
  },
  {
    id: "249064",
    flags: [],
    subject: "SSL certificate expiry warning",
    from: { name: "cPanel", addr: "cpanel@example.com" },
    to: { name: null, addr: "admin@example.com" },
    date: "2026-02-13 04:40",
    has_attachment: true,
  },
]);

const SAMPLE_MESSAGE = JSON.stringify(
  "Dear colleague,\n\nThis is a reminder about today's seminar at 3:30pm in SMLC 356.\n\nTea and cookies at 3pm.\n\nBest,\nMegan"
);

const EMPTY_SEARCH = JSON.stringify([]);

// --- Mock client ---

function createMockClient(): HimalayaClient {
  const client = new HimalayaClient();
  vi.spyOn(client, "listEnvelopes").mockResolvedValue(SAMPLE_ENVELOPES);
  vi.spyOn(client, "searchEnvelopes").mockResolvedValue(EMPTY_SEARCH);
  vi.spyOn(client, "readMessage").mockResolvedValue(SAMPLE_MESSAGE);
  vi.spyOn(client, "readMessageHtml").mockResolvedValue(
    JSON.stringify("<p>Dear colleague,</p><p>Seminar at 3:30pm.</p>")
  );
  return client;
}

// --- Extract tool handler from server ---

function getToolHandler(server: McpServer, toolName: string) {
  const tools = (server as any)._registeredTools as Record<string, any>;
  const tool = tools?.[toolName];
  if (!tool) throw new Error(`Tool "${toolName}" not registered`);
  return tool;
}

describe("Dogfooding: list_emails", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerInboxTools(server, client);
  });

  it("Scenario: 'Check my inbox' — returns readable envelope list", async () => {
    const tool = getToolHandler(server, "list_emails");
    const result = await tool.handler({ folder: undefined, page_size: undefined, page: undefined, account: undefined }, {} as any);

    expect(result.content).toHaveLength(1);
    const text = result.content[0].text;

    // Claude should see email count
    expect(text).toContain("3 emails");
    // Claude should see email IDs (needed for read_email)
    expect(text).toContain("249116");
    expect(text).toContain("249088");
    // Claude should see sender names
    expect(text).toContain("Heatwave Coffee");
    expect(text).toContain("Megan McKay");
    // Claude should see subjects
    expect(text).toContain("Receipt from Heatwave Coffee");
    expect(text).toContain("Reminder - Seminar Today");
    // Claude should see attachment indicator
    expect(text).toContain("[attachment]");
    // Claude should see flags
    expect(text).toContain("[Seen]");
  });

  it("Scenario: 'Check my sent folder' — passes folder param", async () => {
    const tool = getToolHandler(server, "list_emails");
    await tool.handler({ folder: "Sent Items", page_size: undefined, page: undefined, account: undefined }, {} as any);

    expect(client.listEnvelopes).toHaveBeenCalledWith("Sent Items", undefined, undefined, undefined);
  });

  it("Scenario: 'Show me just the last 5 emails' — passes page_size", async () => {
    const tool = getToolHandler(server, "list_emails");
    await tool.handler({ folder: undefined, page_size: 5, page: undefined, account: undefined }, {} as any);

    expect(client.listEnvelopes).toHaveBeenCalledWith(undefined, 5, undefined, undefined);
  });
});

describe("Dogfooding: search_emails", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerInboxTools(server, client);
  });

  it("Scenario: 'Find emails about invoices' — passes structured query", async () => {
    const tool = getToolHandler(server, "search_emails");
    await tool.handler({ query: "subject invoice", folder: undefined, account: undefined }, {} as any);

    expect(client.searchEnvelopes).toHaveBeenCalledWith("subject invoice", undefined, undefined);
  });

  it("Scenario: empty search results — shows helpful message", async () => {
    const tool = getToolHandler(server, "search_emails");
    const result = await tool.handler({ query: "subject nonexistent", folder: undefined, account: undefined }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("No emails found");
    expect(text).toContain("nonexistent");
  });

  it("Scenario: search with results — shows count and summaries", async () => {
    vi.spyOn(client, "searchEnvelopes").mockResolvedValue(SAMPLE_ENVELOPES);
    const tool = getToolHandler(server, "search_emails");
    const result = await tool.handler({ query: "subject seminar", folder: undefined, account: undefined }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("3 emails matching");
  });
});

describe("Dogfooding: read_email", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerReadTools(server, client);
  });

  it("Scenario: 'Read email 249088' — returns full body", async () => {
    const tool = getToolHandler(server, "read_email");
    const result = await tool.handler({ id: "249088", folder: undefined, account: undefined }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("Dear colleague");
    expect(text).toContain("seminar at 3:30pm");
    expect(text).toContain("Tea and cookies");
    expect(result.isError).toBeUndefined();
  });

  it("Scenario: 'Show the HTML version' — returns HTML body", async () => {
    const tool = getToolHandler(server, "read_email_html");
    const result = await tool.handler({ id: "249088", folder: undefined, account: undefined }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("<p>");
    expect(text).toContain("Seminar at 3:30pm");
  });

  it("Scenario: read from specific folder — passes folder", async () => {
    const tool = getToolHandler(server, "read_email");
    await tool.handler({ id: "123", folder: "Archive", account: undefined }, {} as any);

    expect(client.readMessage).toHaveBeenCalledWith("123", "Archive", undefined);
  });
});

describe("Dogfooding: error handling", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerInboxTools(server, client);
    registerReadTools(server, client);
  });

  it("Scenario: himalaya CLI not found — returns actionable error", async () => {
    vi.spyOn(client, "listEnvelopes").mockRejectedValue(
      new Error('himalaya CLI not found at "himalaya". Install with: brew install himalaya')
    );
    const tool = getToolHandler(server, "list_emails");

    await expect(
      tool.handler({ folder: undefined, page_size: undefined, page: undefined, account: undefined }, {} as any)
    ).rejects.toThrow("himalaya CLI not found");
  });

  it("Scenario: auth failure — returns clear error", async () => {
    vi.spyOn(client, "readMessage").mockRejectedValue(
      new Error("himalaya authentication failed: bad credentials")
    );
    const tool = getToolHandler(server, "read_email");

    await expect(
      tool.handler({ id: "123", folder: undefined, account: undefined }, {} as any)
    ).rejects.toThrow("authentication failed");
  });

  it("Scenario: malformed JSON from CLI — returns parse error", async () => {
    vi.spyOn(client, "listEnvelopes").mockResolvedValue("not json at all");
    const tool = getToolHandler(server, "list_emails");
    const result = await tool.handler({ folder: undefined, page_size: undefined, page: undefined, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error:");
  });
});

describe("Dogfooding: output quality", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerInboxTools(server, client);
    registerReadTools(server, client);
  });

  it("email list output is pipe-delimited for easy parsing", async () => {
    const tool = getToolHandler(server, "list_emails");
    const result = await tool.handler({ folder: undefined, page_size: undefined, page: undefined, account: undefined }, {} as any);
    const lines = result.content[0].text.split("\n").filter((l: string) => l.includes("|"));

    // Each line should have ID | date | sender | subject
    for (const line of lines) {
      const parts = line.split("|").map((p: string) => p.trim());
      expect(parts.length).toBeGreaterThanOrEqual(4);
      // First part should be an ID (numeric string)
      expect(parts[0]).toMatch(/^\d+$/);
    }
  });

  it("email IDs in list match what read_email expects", async () => {
    const listTool = getToolHandler(server, "list_emails");
    const listResult = await listTool.handler({ folder: undefined, page_size: undefined, page: undefined, account: undefined }, {} as any);

    // Extract IDs from the list output
    const ids = listResult.content[0].text
      .split("\n")
      .filter((l: string) => l.includes("|"))
      .map((l: string) => l.split("|")[0].trim());

    // Each ID should work with read_email
    const readTool = getToolHandler(server, "read_email");
    for (const id of ids) {
      const result = await readTool.handler({ id, folder: undefined, account: undefined }, {} as any);
      expect(result.content[0].text).toBeTruthy();
    }
  });
});
