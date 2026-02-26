/**
 * Dogfooding tests — simulate realistic Claude usage patterns.
 *
 * These test the full tool registration → handler → output pipeline
 * using a mocked HimalayaClient, verifying that MCP tool responses
 * are useful and well-formatted for Claude.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
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
import { registerFolderTools } from "../src/tools/folders.js";
import { registerComposeNewTools } from "../src/tools/compose-new.js";
import { registerAttachmentTools } from "../src/tools/attachments.js";
import { registerCalendarTools } from "../src/tools/calendar.js";

// --- Module mocks (for attachment + calendar tools that use fs/os/crypto) ---

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    readdir: vi.fn().mockResolvedValue(["report.pdf", "photo.jpg", "plain.txt", "index.html"]),
    stat: vi.fn().mockImplementation((path: string) => {
      if (path.includes("report.pdf")) return Promise.resolve({ isFile: () => true, size: 245760 });
      if (path.includes("photo.jpg")) return Promise.resolve({ isFile: () => true, size: 1048576 });
      if (path.includes("invite.ics")) return Promise.resolve({ isFile: () => true, size: 2048 });
      if (path.includes("agenda.pdf")) return Promise.resolve({ isFile: () => true, size: 51200 });
      if (path.includes("plain.txt")) return Promise.resolve({ isFile: () => true, size: 150 });
      if (path.includes("index.html")) return Promise.resolve({ isFile: () => true, size: 300 });
      return Promise.resolve({ isFile: () => false, size: 0 });
    }),
  };
});
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, tmpdir: vi.fn().mockReturnValue("/tmp") };
});
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomUUID: vi.fn().mockReturnValue("test-uuid-1234") };
});
vi.mock("../src/adapters/calendar.js", () => ({
  parseICS: vi.fn(),
  parseICSFile: vi.fn(),
  createAppleCalendarEvent: vi.fn().mockResolvedValue(undefined),
}));

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

const SAMPLE_FOLDERS = JSON.stringify([
  { name: "INBOX", desc: null },
  { name: "Sent", desc: null },
  { name: "Drafts", desc: null },
  { name: "Trash", desc: null },
  { name: "Archive", desc: null },
]);

// File lists for readdir mock (set per-test via vi.mocked(readdir).mockResolvedValueOnce)
const ATTACHMENT_FILES = ["report.pdf", "photo.jpg", "plain.txt", "index.html"];
const ATTACHMENT_FILES_WITH_ICS = ["invite.ics", "agenda.pdf", "plain.txt"];

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
  vi.spyOn(client, "listFolders").mockResolvedValue(SAMPLE_FOLDERS);
  vi.spyOn(client, "createFolder").mockResolvedValue("{}");
  vi.spyOn(client, "deleteFolder").mockResolvedValue("{}");
  vi.spyOn(client, "downloadAttachments").mockResolvedValue("{}");
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

describe("Dogfooding: list_folders", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerFolderTools(server, client);
  });

  it("Scenario: 'Show me my folders' — returns bullet list of folder names", async () => {
    const tool = getToolHandler(server, "list_folders");
    const result = await tool.handler({ account: undefined }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("INBOX");
    expect(text).toContain("Sent");
    expect(text).toContain("Archive");
    expect(text).toContain("Trash");
    expect(result.isError).toBeUndefined();
  });

  it("Scenario: list folders for work account — passes account param", async () => {
    const tool = getToolHandler(server, "list_folders");
    await tool.handler({ account: "work" }, {} as any);

    expect(client.listFolders).toHaveBeenCalledWith("work");
  });

  it("Scenario: list folders error — returns isError", async () => {
    vi.spyOn(client, "listFolders").mockRejectedValue(new Error("auth expired"));
    const tool = getToolHandler(server, "list_folders");
    const result = await tool.handler({ account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error listing folders");
  });
});

describe("Dogfooding: create_folder", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerFolderTools(server, client);
  });

  it("Scenario: 'Create a Projects folder' — creates and confirms", async () => {
    const tool = getToolHandler(server, "create_folder");
    const result = await tool.handler({ name: "Projects", account: undefined }, {} as any);

    expect(result.content[0].text).toContain("Projects");
    expect(result.content[0].text).toContain("created successfully");
    expect(client.createFolder).toHaveBeenCalledWith("Projects", undefined);
  });

  it("Scenario: create folder error — returns isError", async () => {
    vi.spyOn(client, "createFolder").mockRejectedValue(new Error("folder already exists"));
    const tool = getToolHandler(server, "create_folder");
    const result = await tool.handler({ name: "Existing", account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error creating folder");
  });
});

describe("Dogfooding: delete_folder safety gate", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerFolderTools(server, client);
  });

  it("Scenario: preview before delete — shows warning, does NOT delete", async () => {
    const tool = getToolHandler(server, "delete_folder");
    const result = await tool.handler({ name: "OldStuff", confirm: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("DELETE FOLDER PREVIEW");
    expect(result.content[0].text).toContain("OldStuff");
    expect(result.content[0].text).toContain("NOT been deleted");
    expect(client.deleteFolder).not.toHaveBeenCalled();
  });

  it("Scenario: user confirms — deletes folder", async () => {
    const tool = getToolHandler(server, "delete_folder");
    const result = await tool.handler({ name: "OldStuff", confirm: true, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("deleted successfully");
    expect(client.deleteFolder).toHaveBeenCalledWith("OldStuff", undefined);
  });

  it("Scenario: delete error — returns isError", async () => {
    vi.spyOn(client, "deleteFolder").mockRejectedValue(new Error("permission denied"));
    const tool = getToolHandler(server, "delete_folder");
    const result = await tool.handler({ name: "Protected", confirm: true, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error deleting folder");
  });
});

describe("Dogfooding: compose_email safety gate", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerComposeNewTools(server, client);
  });

  it("Scenario: 'Email alice about meeting' — preview without sending", async () => {
    const tool = getToolHandler(server, "compose_email");
    const result = await tool.handler({
      to: "alice@example.com", subject: "Meeting Request",
      body: "Can we meet Thursday at 2pm?", cc: undefined, bcc: undefined,
      confirm: undefined, account: undefined,
    }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("EMAIL PREVIEW");
    expect(text).toContain("alice@example.com");
    expect(text).toContain("Meeting Request");
    expect(text).toContain("Can we meet Thursday at 2pm?");
    expect(text).toContain("NOT been sent");
    expect(client.sendTemplate).not.toHaveBeenCalled();
  });

  it("Scenario: user confirms compose — sends email", async () => {
    const tool = getToolHandler(server, "compose_email");
    const result = await tool.handler({
      to: "alice@example.com", subject: "Meeting Request",
      body: "Can we meet Thursday at 2pm?", cc: undefined, bcc: undefined,
      confirm: true, account: undefined,
    }, {} as any);

    expect(result.content[0].text).toContain("sent successfully");
    expect(result.content[0].text).toContain("alice@example.com");
    expect(client.sendTemplate).toHaveBeenCalled();
  });

  it("Scenario: compose with CC and BCC — includes all recipients", async () => {
    const tool = getToolHandler(server, "compose_email");
    const result = await tool.handler({
      to: "alice@example.com", subject: "Team Update",
      body: "Weekly status update.", cc: "bob@example.com", bcc: "manager@example.com",
      confirm: undefined, account: undefined,
    }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("alice@example.com");
    expect(text).toContain("Cc: bob@example.com");
    expect(text).toContain("Bcc: manager@example.com");
  });

  it("Scenario: compose send error — returns isError", async () => {
    vi.spyOn(client, "sendTemplate").mockRejectedValue(new Error("SMTP connection refused"));
    const tool = getToolHandler(server, "compose_email");
    const result = await tool.handler({
      to: "alice@example.com", subject: "Test",
      body: "Hello", cc: undefined, bcc: undefined,
      confirm: true, account: undefined,
    }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error sending email");
  });
});

describe("Dogfooding: list_attachments", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerAttachmentTools(server, client);
  });

  it("Scenario: 'What attachments does email 249064 have?' — lists files with sizes", async () => {
    const tool = getToolHandler(server, "list_attachments");
    const result = await tool.handler({ id: "249064", folder: undefined, account: undefined }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("report.pdf");
    expect(text).toContain("photo.jpg");
    expect(text).toContain("KB");
    expect(text).toContain("249064");
    expect(result.isError).toBeUndefined();
  });

  it("Scenario: no attachments — shows helpful message", async () => {
    const { readdir } = await import("node:fs/promises");
    vi.mocked(readdir).mockResolvedValueOnce(["plain.txt", "index.html"] as any);
    const tool = getToolHandler(server, "list_attachments");
    const result = await tool.handler({ id: "249088", folder: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("No attachments found");
  });

  it("Scenario: list attachments error — returns isError", async () => {
    vi.spyOn(client, "downloadAttachments").mockRejectedValue(new Error("timeout"));
    const tool = getToolHandler(server, "list_attachments");
    const result = await tool.handler({ id: "249064", folder: undefined, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error listing attachments");
  });
});

describe("Dogfooding: download_attachment", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerAttachmentTools(server, client);
  });

  it("Scenario: 'Download the PDF from that email' — returns file path", async () => {
    const tool = getToolHandler(server, "download_attachment");
    const result = await tool.handler({
      id: "249064", filename: "report.pdf",
      folder: undefined, account: undefined,
    }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("Downloaded");
    expect(text).toContain("report.pdf");
    expect(text).toContain("/tmp/himalaya-mcp-test-uuid-1234");
    expect(client.downloadAttachments).toHaveBeenCalled();
  });

  it("Scenario: download error — returns isError", async () => {
    vi.spyOn(client, "downloadAttachments").mockRejectedValue(new Error("attachment not found"));
    const tool = getToolHandler(server, "download_attachment");
    const result = await tool.handler({
      id: "249064", filename: "missing.pdf",
      folder: undefined, account: undefined,
    }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error downloading attachment");
  });
});

describe("Dogfooding: extract_calendar_event", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(async () => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerCalendarTools(server, client);

    // Mock readdir to return files including .ics
    const { readdir } = await import("node:fs/promises");
    vi.mocked(readdir).mockResolvedValue(ATTACHMENT_FILES_WITH_ICS as any);

    // Mock parseICSFile to return a structured event
    const { parseICSFile } = await import("../src/adapters/calendar.js");
    vi.mocked(parseICSFile).mockResolvedValue({
      summary: "Team Standup",
      dtstart: "2026-02-16T09:00:00",
      dtend: "2026-02-16T09:30:00",
      location: "Zoom",
      organizer: "boss@example.com",
      description: "Daily standup meeting",
    });
  });

  it("Scenario: 'Check the calendar invite in email 12345' — extracts event details", async () => {
    const tool = getToolHandler(server, "extract_calendar_event");
    const result = await tool.handler({ id: "12345", folder: undefined, account: undefined }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("Team Standup");
    expect(text).toContain("2026-02-16T09:00:00");
    expect(text).toContain("2026-02-16T09:30:00");
    expect(text).toContain("Zoom");
    expect(text).toContain("boss@example.com");
    expect(text).toContain("create_calendar_event");
    expect(result.isError).toBeUndefined();
  });

  it("Scenario: no ICS attachment — shows helpful message", async () => {
    const { readdir } = await import("node:fs/promises");
    vi.mocked(readdir).mockResolvedValueOnce(ATTACHMENT_FILES as any);
    const tool = getToolHandler(server, "extract_calendar_event");
    const result = await tool.handler({ id: "249064", folder: undefined, account: undefined }, {} as any);

    expect(result.content[0].text).toContain("No calendar attachment");
  });

  it("Scenario: ICS parse fails — returns isError", async () => {
    const { parseICSFile } = await import("../src/adapters/calendar.js");
    vi.mocked(parseICSFile).mockResolvedValue(null);
    const tool = getToolHandler(server, "extract_calendar_event");
    const result = await tool.handler({ id: "12345", folder: undefined, account: undefined }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Could not parse calendar event");
  });
});

describe("Dogfooding: create_calendar_event safety gate", () => {
  let server: McpServer;
  let client: HimalayaClient;

  beforeEach(() => {
    server = new McpServer({ name: "test", version: "0.0.1" });
    client = createMockClient();
    registerCalendarTools(server, client);
  });

  it("Scenario: preview before creating — shows event details, does NOT create", async () => {
    const tool = getToolHandler(server, "create_calendar_event");
    const result = await tool.handler({
      summary: "Team Standup", dtstart: "2026-02-16T09:00:00",
      dtend: "2026-02-16T09:30:00", location: "Zoom",
      description: undefined, confirm: undefined,
    }, {} as any);

    const text = result.content[0].text;
    expect(text).toContain("CALENDAR EVENT PREVIEW");
    expect(text).toContain("Team Standup");
    expect(text).toContain("Zoom");
    expect(text).toContain("NOT been created");
  });

  it("Scenario: user confirms — creates calendar event", async () => {
    const tool = getToolHandler(server, "create_calendar_event");
    const result = await tool.handler({
      summary: "Team Standup", dtstart: "2026-02-16T09:00:00",
      dtend: "2026-02-16T09:30:00", location: "Zoom",
      description: undefined, confirm: true,
    }, {} as any);

    expect(result.content[0].text).toContain("created successfully");
    expect(result.content[0].text).toContain("Team Standup");
  });

  it("Scenario: create error — returns isError", async () => {
    const { createAppleCalendarEvent } = await import("../src/adapters/calendar.js");
    vi.mocked(createAppleCalendarEvent).mockRejectedValue(new Error("Calendar access denied"));
    const tool = getToolHandler(server, "create_calendar_event");
    const result = await tool.handler({
      summary: "Test Event", dtstart: "2026-02-16T09:00:00",
      dtend: "2026-02-16T10:00:00", location: undefined,
      description: undefined, confirm: true,
    }, {} as any);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error creating calendar event");
  });
});

// ========================================================================
// Packaging & Distribution Validation
// ========================================================================

describe("Packaging: version consistency", () => {
  const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));
  const pluginJson = JSON.parse(
    readFileSync(join(PROJECT_ROOT, "himalaya-mcp-plugin", ".claude-plugin", "plugin.json"), "utf-8")
  );

  it("src/index.ts VERSION matches package.json", () => {
    expect(VERSION).toBe(pkgJson.version);
  });

  it("plugin.json version matches package.json", () => {
    expect(pluginJson.version).toBe(pkgJson.version);
  });

  it("src/index.ts NAME is himalaya-mcp (MCP server identity)", () => {
    expect(NAME).toBe("himalaya-mcp");
  });

  it("all three versions are in sync", () => {
    expect(VERSION).toBe(pluginJson.version);
    expect(VERSION).toBe(pkgJson.version);
  });
});

describe("Packaging: plugin manifest structure", () => {
  const pluginJson = JSON.parse(
    readFileSync(join(PROJECT_ROOT, "himalaya-mcp-plugin", ".claude-plugin", "plugin.json"), "utf-8")
  );

  it("has required top-level fields", () => {
    expect(pluginJson.name).toBe("email");
    expect(pluginJson.version).toBeTruthy();
    expect(pluginJson.description).toBeTruthy();
  });

  it("has skills directory with valid skill files", () => {
    const skillsDir = join(PROJECT_ROOT, "himalaya-mcp-plugin", "skills");
    expect(existsSync(skillsDir)).toBe(true);
    const expectedSkills = ["inbox.md", "triage.md", "digest.md", "reply.md", "help.md", "compose.md", "attachments.md", "search.md", "manage.md", "stats.md", "config.md"];
    for (const skill of expectedSkills) {
      expect(existsSync(join(skillsDir, skill))).toBe(true);
    }
  });

  it("has agents directory with valid agent files", () => {
    const agentsDir = join(PROJECT_ROOT, "himalaya-mcp-plugin", "agents");
    expect(existsSync(agentsDir)).toBe(true);
    expect(existsSync(join(agentsDir, "email-assistant.md"))).toBe(true);
  });

  it("only contains allowed schema fields", () => {
    const allowedKeys = ["name", "version", "description", "author", "hooks"];
    for (const key of Object.keys(pluginJson)) {
      expect(allowedKeys).toContain(key);
    }
  });
});

describe("Packaging: pre-send hook", () => {
  const hookPath = join(PROJECT_ROOT, "himalaya-mcp-plugin", ".claude-plugin", "hooks", "pre-send.sh");

  it("hook script exists and is executable", () => {
    expect(existsSync(hookPath)).toBe(true);
    const { execFileSync } = require("node:child_process");
    const stat = execFileSync("stat", ["-f", "%Lp", hookPath], { encoding: "utf-8" }).trim();
    expect(parseInt(stat, 8) & 0o111).toBeGreaterThan(0);
  });

  it("allows non-send tools (exit 0)", () => {
    const { execFileSync } = require("node:child_process");
    const input = JSON.stringify({ tool_name: "list_emails", tool_input: {} });
    const result = execFileSync("/bin/bash", [hookPath], {
      input,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    // Should exit 0 (no error thrown)
    expect(result).toBeDefined();
  });

  it("allows send_email with confirm=false (no preview)", () => {
    const { execFileSync } = require("node:child_process");
    const input = JSON.stringify({
      tool_name: "send_email",
      tool_input: { to: "test@example.com", subject: "Test", body: "Hello", confirm: false },
    });
    const result = execFileSync("/bin/bash", [hookPath], {
      input,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    expect(result).toBeDefined();
  });

  it("shows preview on stderr for send_email with confirm=true", () => {
    const { execFileSync } = require("node:child_process");
    const input = JSON.stringify({
      tool_name: "send_email",
      tool_input: { to: "alice@example.com", subject: "Meeting", body: "Hi Alice", confirm: "true" },
    });
    try {
      execFileSync("/bin/bash", [hookPath], {
        input,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // execFileSync captures stderr differently; use spawnSync instead
    }
    // Use spawnSync for stderr capture
    const { spawnSync } = require("node:child_process");
    const proc = spawnSync("/bin/bash", [hookPath], {
      input,
      encoding: "utf-8",
    });
    expect(proc.status).toBe(0);
    expect(proc.stderr).toContain("Email Send Preview");
    expect(proc.stderr).toContain("alice@example.com");
    expect(proc.stderr).toContain("Meeting");
  });

  it("shows preview for compose_email with confirm=true", () => {
    const { spawnSync } = require("node:child_process");
    const input = JSON.stringify({
      tool_name: "compose_email",
      tool_input: { to: "bob@example.com", subject: "Hello", body: "Line1\nLine2\nLine3\nLine4\nLine5", confirm: "true" },
    });
    const proc = spawnSync("/bin/bash", [hookPath], {
      input,
      encoding: "utf-8",
    });
    expect(proc.status).toBe(0);
    expect(proc.stderr).toContain("bob@example.com");
    expect(proc.stderr).toContain("5 lines total");
  });

  it("plugin.json hooks use CLAUDE_PLUGIN_ROOT for path resolution", () => {
    const pJson = JSON.parse(
      readFileSync(join(PROJECT_ROOT, "himalaya-mcp-plugin", ".claude-plugin", "plugin.json"), "utf-8")
    );
    expect(pJson.hooks).toBeDefined();
    expect(pJson.hooks.PreToolUse).toBeDefined();
    expect(pJson.hooks.PreToolUse[0].hooks[0].command).toContain("${CLAUDE_PLUGIN_ROOT}");
    expect(pJson.hooks.PreToolUse[0].hooks[0].command).not.toContain("./.");
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
    expect(marketplace.plugins[0].name).toBe("email");
    expect(marketplace.plugins[0].source).toBe("./himalaya-mcp-plugin");
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
      readFileSync(join(PROJECT_ROOT, "himalaya-mcp-plugin", ".claude-plugin", "plugin.json"), "utf-8")
    );
    expect(pluginJson.mcpServers).toBeUndefined();
  });
});

describe("Packaging: homebrew-release workflow", () => {
  const workflowPath = join(PROJECT_ROOT, ".github", "workflows", "homebrew-release.yml");
  const workflowContent = readFileSync(workflowPath, "utf-8");

  it("exists in .github/workflows/", () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it("triggers on release published and workflow_dispatch", () => {
    expect(workflowContent).toContain("release:");
    expect(workflowContent).toContain("types: [published]");
    expect(workflowContent).toContain("workflow_dispatch:");
  });

  it("has all three required jobs", () => {
    // validate → prepare → update-homebrew pipeline
    expect(workflowContent).toContain("validate:");
    expect(workflowContent).toContain("prepare:");
    expect(workflowContent).toContain("update-homebrew:");
  });

  it("prepare depends on validate", () => {
    expect(workflowContent).toContain("needs: validate");
  });

  it("update-homebrew depends on prepare", () => {
    expect(workflowContent).toContain("needs: prepare");
  });

  it("references correct formula name", () => {
    expect(workflowContent).toContain("formula_name: himalaya-mcp");
  });

  it("downloads tarball from correct repo", () => {
    expect(workflowContent).toContain(
      "https://github.com/Data-Wise/himalaya-mcp/archive/refs/tags/v"
    );
  });

  it("calls reusable update-formula workflow", () => {
    expect(workflowContent).toContain(
      "Data-Wise/homebrew-tap/.github/workflows/update-formula.yml@main"
    );
  });

  it("references HOMEBREW_TAP_GITHUB_TOKEN secret", () => {
    expect(workflowContent).toContain("HOMEBREW_TAP_GITHUB_TOKEN");
  });

  it("validate job runs build, test, and bundle", () => {
    expect(workflowContent).toContain("npm run build");
    expect(workflowContent).toContain("npm test");
    expect(workflowContent).toContain("npm run build:bundle");
  });

  it("validate job checks version consistency", () => {
    expect(workflowContent).toContain("package.json");
    expect(workflowContent).toContain("Version mismatch");
  });

  it("prepare job has retry logic for tarball download", () => {
    expect(workflowContent).toContain("for i in 1 2 3 4 5");
    expect(workflowContent).toContain("sleep 10");
  });

  it("prepare job uses curl timeout to prevent stalled connections", () => {
    expect(workflowContent).toContain("--max-time 30");
  });

  it("prepare job uses mktemp for safe temp file handling", () => {
    expect(workflowContent).toContain("mktemp /tmp/tarball-XXXXXX");
  });

  it("prepare job uses sha256sum (native on Ubuntu runners)", () => {
    expect(workflowContent).toContain("sha256sum");
    expect(workflowContent).not.toContain("shasum");
  });

  it("prepare job guards against empty tarball SHA", () => {
    // The SHA of an empty file — used to detect incomplete downloads
    expect(workflowContent).toContain(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("uses env variables for GitHub context (injection safe)", () => {
    // Version extraction uses env vars, not direct ${{ }} in run blocks
    expect(workflowContent).toContain("EVENT_NAME: ${{ github.event_name }}");
    expect(workflowContent).toContain("INPUT_VERSION: ${{ github.event.inputs.version }}");
    expect(workflowContent).toContain("GIT_REF: ${{ github.ref }}");
  });

  it("prepare job consumes version from validate (single source of truth)", () => {
    expect(workflowContent).toContain("needs.validate.outputs.version");
  });

  it("validate job outputs version for downstream jobs", () => {
    // validate outputs version so prepare doesn't re-derive it
    expect(workflowContent).toContain("steps.version.outputs.version");
  });

  it("workflow_dispatch accepts version and auto_merge inputs", () => {
    expect(workflowContent).toContain("version:");
    expect(workflowContent).toContain("auto_merge:");
    expect(workflowContent).toContain("type: string");
    expect(workflowContent).toContain("type: boolean");
  });

  it("all workflow files are present", () => {
    const workflowDir = join(PROJECT_ROOT, ".github", "workflows");
    const files = readdirSync(workflowDir).sort();
    expect(files).toContain("ci.yml");
    expect(files).toContain("docs.yml");
    expect(files).toContain("homebrew-release.yml");
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

  it("has build:mcpb script for Desktop Extension packaging", () => {
    expect(pkgJson.scripts["build:mcpb"]).toBeDefined();
    expect(pkgJson.scripts["build:mcpb"]).toContain("build-mcpb");
  });
});

// =============================================================================
// .mcpb Desktop Extension packaging
// =============================================================================

describe("Packaging: mcpb/manifest.json", () => {
  const manifestPath = join(PROJECT_ROOT, "mcpb", "manifest.json");

  it("exists in mcpb/ directory", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  it("uses manifest_version 0.3", () => {
    expect(manifest.manifest_version).toBe("0.3");
  });

  it("has required top-level fields", () => {
    expect(manifest.name).toBe("himalaya-mcp");
    expect(manifest.version).toBeTruthy();
    expect(manifest.description).toBeTruthy();
    expect(manifest.author).toBeDefined();
    expect(manifest.author.name).toBe("Data-Wise");
    expect(manifest.server).toBeDefined();
  });

  it("has display_name for Claude Desktop UI", () => {
    expect(manifest.display_name).toBe("Himalaya Email");
  });

  it("version matches package.json", () => {
    const pkgJson = JSON.parse(readFileSync(join(PROJECT_ROOT, "package.json"), "utf-8"));
    expect(manifest.version).toBe(pkgJson.version);
  });

  it("server type is node with correct entry point", () => {
    expect(manifest.server.type).toBe("node");
    expect(manifest.server.entry_point).toBe("dist/index.js");
  });

  it("mcp_config uses __dirname template variable", () => {
    expect(manifest.server.mcp_config.command).toBe("node");
    expect(manifest.server.mcp_config.args[0]).toContain("${__dirname}");
    expect(manifest.server.mcp_config.args[0]).toContain("dist/index.js");
  });

  it("mcp_config.env maps user_config to HIMALAYA_ env vars", () => {
    const env = manifest.server.mcp_config.env;
    expect(env.HIMALAYA_BINARY).toBe("${user_config.himalaya_binary}");
    expect(env.HIMALAYA_ACCOUNT).toBe("${user_config.himalaya_account}");
    expect(env.HIMALAYA_FOLDER).toBe("${user_config.himalaya_folder}");
  });

  it("declares all 3 user_config fields with correct types", () => {
    expect(manifest.user_config.himalaya_binary.type).toBe("file");
    expect(manifest.user_config.himalaya_binary.required).toBe(false);

    expect(manifest.user_config.himalaya_account.type).toBe("string");
    expect(manifest.user_config.himalaya_account.required).toBe(false);

    expect(manifest.user_config.himalaya_folder.type).toBe("string");
    expect(manifest.user_config.himalaya_folder.default).toBe("INBOX");
    expect(manifest.user_config.himalaya_folder.required).toBe(false);
  });

  it("compatibility targets macOS with Node 22+", () => {
    expect(manifest.compatibility.platforms).toEqual(["darwin"]);
    expect(manifest.compatibility.runtimes.node).toBe(">=22.0.0");
  });

  it("lists exactly 19 tools", () => {
    expect(manifest.tools).toHaveLength(19);
  });

  it("lists exactly 4 prompts", () => {
    expect(manifest.prompts).toHaveLength(4);
  });

  it("every tool has name and description", () => {
    for (const tool of manifest.tools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
    }
  });

  it("every prompt has name, description, and text", () => {
    for (const prompt of manifest.prompts) {
      expect(prompt.name).toBeTruthy();
      expect(prompt.description).toBeTruthy();
      expect(prompt.text).toBeTruthy();
    }
  });

  it("manifest tool names match server-registered tools (no drift)", () => {
    const manifestToolNames = manifest.tools.map((t: any) => t.name).sort();
    expect(manifestToolNames).toEqual([
      "compose_email",
      "copy_to_clipboard",
      "create_action_item",
      "create_calendar_event",
      "create_folder",
      "delete_folder",
      "download_attachment",
      "draft_reply",
      "export_to_markdown",
      "extract_calendar_event",
      "flag_email",
      "list_attachments",
      "list_emails",
      "list_folders",
      "move_email",
      "read_email",
      "read_email_html",
      "search_emails",
      "send_email",
    ]);
  });

  it("manifest prompt names match server-registered prompts (no drift)", () => {
    const manifestPromptNames = manifest.prompts.map((p: any) => p.name).sort();
    expect(manifestPromptNames).toEqual([
      "daily_email_digest",
      "draft_reply",
      "summarize_email",
      "triage_inbox",
    ]);
  });

  it("has license and repository metadata", () => {
    expect(manifest.license).toBe("MIT");
    expect(manifest.repository.type).toBe("git");
    expect(manifest.repository.url).toContain("Data-Wise/himalaya-mcp");
  });
});

describe("Packaging: mcpb build infrastructure", () => {
  it("build script exists and is executable", () => {
    const scriptPath = join(PROJECT_ROOT, "scripts", "build-mcpb.sh");
    expect(existsSync(scriptPath)).toBe(true);
  });

  it(".mcpbignore exists in mcpb/ directory", () => {
    const ignorePath = join(PROJECT_ROOT, "mcpb", ".mcpbignore");
    expect(existsSync(ignorePath)).toBe(true);
  });

  it(".mcpbignore excludes dev files from bundle", () => {
    const ignoreContent = readFileSync(join(PROJECT_ROOT, "mcpb", ".mcpbignore"), "utf-8");
    expect(ignoreContent).toContain("node_modules/");
    expect(ignoreContent).toContain("src/");
    expect(ignoreContent).toContain("tests/");
    expect(ignoreContent).toContain("*.ts");
    expect(ignoreContent).toContain("*.md");
  });

  it(".gitignore excludes .mcpb build artifacts", () => {
    const gitignore = readFileSync(join(PROJECT_ROOT, ".gitignore"), "utf-8");
    expect(gitignore).toContain("*.mcpb");
    expect(gitignore).toContain("mcpb/dist/");
  });
});

describe("Packaging: CI validates mcpb", () => {
  const ciContent = readFileSync(join(PROJECT_ROOT, ".github", "workflows", "ci.yml"), "utf-8");

  it("ci.yml has validate-mcpb job", () => {
    expect(ciContent).toContain("validate-mcpb:");
  });

  it("validate-mcpb runs mcpb validate", () => {
    expect(ciContent).toContain("@anthropic-ai/mcpb validate mcpb/");
  });

  it("validate-mcpb runs build:mcpb", () => {
    expect(ciContent).toContain("npm run build:mcpb");
  });

  it("validate-mcpb verifies bundle output", () => {
    expect(ciContent).toContain("himalaya-mcp-v*.mcpb");
  });
});

describe("Packaging: release includes mcpb", () => {
  const releaseContent = readFileSync(
    join(PROJECT_ROOT, ".github", "workflows", "homebrew-release.yml"),
    "utf-8"
  );

  it("release workflow builds mcpb bundle", () => {
    expect(releaseContent).toContain("npm run build:mcpb");
  });

  it("release workflow uploads mcpb artifact", () => {
    expect(releaseContent).toContain("upload-artifact@v4");
    expect(releaseContent).toContain("mcpb-bundle");
  });

  it("release workflow has upload-mcpb job", () => {
    expect(releaseContent).toContain("upload-mcpb:");
    expect(releaseContent).toContain("Upload MCPB to Release");
  });

  it("upload-mcpb uses gh release upload", () => {
    expect(releaseContent).toContain("gh release upload");
  });

  it("upload-mcpb uses env vars for GitHub context (injection safe)", () => {
    expect(releaseContent).toContain("GH_TOKEN: ${{ github.token }}");
    expect(releaseContent).toContain("TAG_NAME: ${{ github.event.release.tag_name }}");
  });
});
