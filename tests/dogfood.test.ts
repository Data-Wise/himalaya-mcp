/**
 * Dogfooding tests — simulate realistic Claude usage patterns.
 *
 * These test the full tool registration → handler → output pipeline
 * using a mocked HimalayaClient, verifying that MCP tool responses
 * are useful and well-formatted for Claude.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";
import { VERSION, NAME } from "../src/index.js";
import { registerInboxTools } from "../src/tools/inbox.js";
import { registerReadTools } from "../src/tools/read.js";
import { registerManageTools } from "../src/tools/manage.js";
import { registerActionTools } from "../src/tools/actions.js";
import { registerComposeTools } from "../src/tools/compose.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

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
  vi.spyOn(client, "flagMessage").mockResolvedValue("{}");
  vi.spyOn(client, "moveMessage").mockResolvedValue("{}");
  vi.spyOn(client, "replyTemplate").mockResolvedValue(
    JSON.stringify("From: user@example.com\nTo: mmckay@unm.edu\nSubject: Re: Reminder - Seminar Today\n\nThank you for the reminder.\n\n> Dear colleague,\n> Seminar at 3:30pm.")
  );
  vi.spyOn(client, "sendTemplate").mockResolvedValue("{}");
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

describe("Dogfooding: flag_email", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerManageTools(server, client);
  });

  it("Scenario: 'Flag this as important' — adds Flagged flag", async () => {
    const tool = getToolHandler(server, "flag_email");
    const result = await tool.handler({ id: "249088", flags: ["Flagged"], action: "add", folder: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("Added");
    expect(result.content[0].text).toContain("Flagged");
    expect(result.content[0].text).toContain("249088");
    expect(client.flagMessage).toHaveBeenCalledWith("249088", ["Flagged"], "add", undefined, undefined);
  });

  it("Scenario: 'Mark as read' — adds Seen flag", async () => {
    const tool = getToolHandler(server, "flag_email");
    const result = await tool.handler({ id: "249088", flags: ["Seen"], action: "add", folder: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("Added");
    expect(result.content[0].text).toContain("Seen");
  });

  it("Scenario: 'Unflag this' — removes Flagged flag", async () => {
    const tool = getToolHandler(server, "flag_email");
    const result = await tool.handler({ id: "249088", flags: ["Flagged"], action: "remove", folder: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("Removed");
    expect(result.content[0].text).toContain("Flagged");
  });

  it("Scenario: flag error — returns isError", async () => {
    vi.spyOn(client, "flagMessage").mockRejectedValue(new Error("connection timeout"));
    const tool = getToolHandler(server, "flag_email");
    const result = await tool.handler({ id: "249088", flags: ["Seen"], action: "add", folder: undefined, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error flagging email");
  });
});

describe("Dogfooding: move_email", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerManageTools(server, client);
  });

  it("Scenario: 'Archive this email' — moves to Archive", async () => {
    const tool = getToolHandler(server, "move_email");
    const result = await tool.handler({ id: "249064", target_folder: "Archive", folder: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("Moved");
    expect(result.content[0].text).toContain("249064");
    expect(result.content[0].text).toContain("Archive");
    expect(client.moveMessage).toHaveBeenCalledWith("249064", "Archive", undefined, undefined);
  });

  it("Scenario: 'Delete this spam' — moves to Trash", async () => {
    const tool = getToolHandler(server, "move_email");
    const result = await tool.handler({ id: "249064", target_folder: "Trash", folder: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("Trash");
  });

  it("Scenario: move error — returns isError", async () => {
    vi.spyOn(client, "moveMessage").mockRejectedValue(new Error("folder not found"));
    const tool = getToolHandler(server, "move_email");
    const result = await tool.handler({ id: "249064", target_folder: "NonExistent", folder: undefined, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error moving email");
  });
});

describe("Dogfooding: export_to_markdown", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerActionTools(server, client);
  });

  it("Scenario: 'Export email 249088 as markdown' — returns formatted md", async () => {
    const tool = getToolHandler(server, "export_to_markdown");
    const result = await tool.handler({ id: "249088", folder: undefined, account: undefined }, {} as any);

    const text = result.content[0].text;
    // Has YAML frontmatter
    expect(text).toMatch(/^---/);
    expect(text).toContain("subject:");
    expect(text).toContain("from:");
    expect(text).toContain("date:");
    expect(text).toContain("flags:");
    // Has heading with subject
    expect(text).toContain("# Reminder - Seminar Today");
    // Has body
    expect(text).toContain("Dear colleague");
    expect(text).toContain("seminar at 3:30pm");
  });

  it("Scenario: email not found — returns error", async () => {
    const tool = getToolHandler(server, "export_to_markdown");
    const result = await tool.handler({ id: "999999", folder: undefined, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("Scenario: export error — returns isError", async () => {
    vi.spyOn(client, "listEnvelopes").mockRejectedValue(new Error("timeout"));
    const tool = getToolHandler(server, "export_to_markdown");
    const result = await tool.handler({ id: "249088", folder: undefined, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error exporting email");
  });
});

describe("Dogfooding: draft_reply", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerComposeTools(server, client);
  });

  it("Scenario: 'Reply to the seminar email' — generates draft", async () => {
    const tool = getToolHandler(server, "draft_reply");
    const result = await tool.handler({
      id: "249088", body: undefined, reply_all: undefined,
      folder: undefined, account: undefined,
    }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("DRAFT");
    expect(text).toContain("Re: Reminder - Seminar Today");
    expect(text).toContain("not sent");
    expect(result.isError).toBeUndefined();
  });
});

describe("Dogfooding: send_email safety gate", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerComposeTools(server, client);
  });

  it("Scenario: preview before send — does NOT send", async () => {
    const tool = getToolHandler(server, "send_email");
    const result = await tool.handler({
      template: "From: me@test.com\nSubject: Test\n\nHello",
      confirm: undefined, account: undefined,
    }, {} as any);

    expect(result.content[0].text).toContain("NOT been sent");
    expect(client.sendTemplate).not.toHaveBeenCalled();
  });

  it("Scenario: user confirms — sends email", async () => {
    const tool = getToolHandler(server, "send_email");
    const template = "From: me@test.com\nTo: you@test.com\nSubject: Hi\n\nHello!";
    const result = await tool.handler({
      template, confirm: true, account: undefined,
    }, {} as any);

    expect(result.content[0].text).toContain("sent successfully");
    expect(client.sendTemplate).toHaveBeenCalledWith(template, undefined);
  });
});

describe("Dogfooding: create_action_item", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerActionTools(server, client);
  });

  it("Scenario: 'Extract actions from seminar email' — returns structured context", async () => {
    const tool = getToolHandler(server, "create_action_item");
    const result = await tool.handler({
      id: "249088", folder: undefined, account: undefined,
    }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("Reminder - Seminar Today");
    expect(text).toContain("Megan McKay");
    expect(text).toContain("Action items");
    expect(text).toContain("Deadlines");
    expect(text).toContain("seminar at 3:30pm");
  });

  it("Scenario: email body error — returns isError", async () => {
    vi.spyOn(client, "readMessage").mockResolvedValue("");
    const tool = getToolHandler(server, "create_action_item");
    const result = await tool.handler({
      id: "249088", folder: undefined, account: undefined,
    }, {} as any);

    expect(result.isError).toBe(true);
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

// ========================================================================
// Packaging & Distribution Validation
// ========================================================================

describe("Packaging: version consistency", () => {
  const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));
  const pluginJson = JSON.parse(
    readFileSync(join(PROJECT_ROOT, ".claude-plugin", "plugin.json"), "utf-8")
  );

  it("src/index.ts VERSION matches package.json", () => {
    expect(VERSION).toBe(pkgJson.version);
  });

  it("plugin.json version matches package.json", () => {
    expect(pluginJson.version).toBe(pkgJson.version);
  });

  it("src/index.ts NAME is himalaya-mcp", () => {
    expect(NAME).toBe("himalaya-mcp");
  });

  it("all three versions are in sync", () => {
    expect(VERSION).toBe(pluginJson.version);
    expect(VERSION).toBe(pkgJson.version);
  });
});

describe("Packaging: plugin manifest structure", () => {
  const pluginJson = JSON.parse(
    readFileSync(join(PROJECT_ROOT, ".claude-plugin", "plugin.json"), "utf-8")
  );

  it("has required top-level fields", () => {
    expect(pluginJson.name).toBe("himalaya-mcp");
    expect(pluginJson.version).toBeTruthy();
    expect(pluginJson.description).toBeTruthy();
  });

  it("has skills directory with valid skill files", () => {
    const skillsDir = join(PROJECT_ROOT, "plugin", "skills");
    expect(existsSync(skillsDir)).toBe(true);
    const expectedSkills = ["inbox.md", "triage.md", "digest.md", "reply.md", "help.md"];
    for (const skill of expectedSkills) {
      expect(existsSync(join(skillsDir, skill))).toBe(true);
    }
  });

  it("has agents directory with valid agent files", () => {
    const agentsDir = join(PROJECT_ROOT, "plugin", "agents");
    expect(existsSync(agentsDir)).toBe(true);
    expect(existsSync(join(agentsDir, "email-assistant.md"))).toBe(true);
  });

  it("only contains allowed schema fields", () => {
    const allowedKeys = ["name", "version", "description", "author"];
    for (const key of Object.keys(pluginJson)) {
      expect(allowedKeys).toContain(key);
    }
  });
});

describe("Packaging: marketplace.json", () => {
  const marketplacePath = join(PROJECT_ROOT, ".claude-plugin", "marketplace.json");

  it("exists in .claude-plugin/", () => {
    expect(existsSync(marketplacePath)).toBe(true);
  });

  it("has valid structure for GitHub plugin discovery", () => {
    const marketplace = JSON.parse(readFileSync(marketplacePath, "utf-8"));
    expect(marketplace.name).toBeTruthy();
    expect(marketplace.owner).toBeDefined();
    expect(marketplace.owner.name).toBe("Data-Wise");
    expect(marketplace.plugins).toBeDefined();
    expect(marketplace.plugins.length).toBe(1);
    expect(marketplace.plugins[0].name).toBe("himalaya-mcp");
    expect(marketplace.plugins[0].source).toBe(".");
    expect(marketplace.plugins[0].description).toBeTruthy();
  });
});

describe("Packaging: .mcp.json", () => {
  const mcpJsonPath = join(PROJECT_ROOT, ".mcp.json");

  it("exists at project root", () => {
    expect(existsSync(mcpJsonPath)).toBe(true);
  });

  it("declares himalaya server with CLAUDE_PLUGIN_ROOT", () => {
    const mcpJson = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    expect(mcpJson.mcpServers?.himalaya).toBeDefined();
    expect(mcpJson.mcpServers.himalaya.command).toBe("node");
    expect(mcpJson.mcpServers.himalaya.args[0]).toContain("${CLAUDE_PLUGIN_ROOT}");
  });

  it("is the sole MCP server declaration (not duplicated in plugin.json)", () => {
    const pluginJson = JSON.parse(
      readFileSync(join(PROJECT_ROOT, ".claude-plugin", "plugin.json"), "utf-8")
    );
    expect(pluginJson.mcpServers).toBeUndefined();
  });
});

describe("Packaging: package.json distribution fields", () => {
  const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));

  it("has bin entry for CLI", () => {
    expect(pkgJson.bin).toBeDefined();
    expect(pkgJson.bin["himalaya-mcp"]).toBe("dist/cli/setup.js");
  });

  it("has build:bundle script for production bundling", () => {
    expect(pkgJson.scripts["build:bundle"]).toBeDefined();
    expect(pkgJson.scripts["build:bundle"]).toContain("esbuild");
    expect(pkgJson.scripts["build:bundle"]).toContain("--bundle");
    expect(pkgJson.scripts["build:bundle"]).toContain("--minify");
  });

  it("has esbuild as dev dependency", () => {
    expect(pkgJson.devDependencies.esbuild).toBeDefined();
  });

  it("declares ESM module type", () => {
    expect(pkgJson.type).toBe("module");
  });

  it("main entry points to dist/index.js", () => {
    expect(pkgJson.main).toBe("dist/index.js");
  });
});
