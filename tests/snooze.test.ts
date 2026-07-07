import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSnoozeTools } from "../src/tools/snooze";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as fs from "node:fs";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe("snooze_email", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue("[]");
    vi.mocked(fs.writeFileSync).mockClear();
  });

  it("registers the snooze_email tool", () => {
    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);
    expect(server.registerTool).toHaveBeenCalledWith(
      "snooze_email",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("tool description mentions snooze", () => {
    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);
    const call = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "snooze_email");
    const description = (call[1] as any).description;
    expect(description).toContain("Snooze");
  });

  it("parses ISO date format", async () => {
    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "snooze_email")[2];
    const result = await handler({ id: "123", folder: "INBOX", account: "", subject: "Test", snoozeUntil: "2026-07-10T09:00:00" });

    expect(result.content[0].text).toContain("snoozed until");
    expect(result.isError).toBeUndefined();
  });

  it("parses 'tomorrow' shorthand", async () => {
    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "snooze_email")[2];
    const result = await handler({ id: "456", folder: "INBOX", account: "", subject: "Follow up", snoozeUntil: "tomorrow" });

    expect(result.content[0].text).toContain("snoozed until");
    expect(result.isError).toBeUndefined();
  });

  it("parses 'monday' shorthand", async () => {
    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "snooze_email")[2];
    const result = await handler({ id: "789", folder: "INBOX", account: "", subject: "Week start", snoozeUntil: "monday" });

    expect(result.content[0].text).toContain("snoozed until");
  });

  it("parses hour shorthand (e.g., '2h')", async () => {
    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "snooze_email")[2];
    const result = await handler({ id: "111", folder: "INBOX", account: "", subject: "Quick reminder", snoozeUntil: "2h" });

    expect(result.content[0].text).toContain("snoozed until");
  });

  it("handles write errors gracefully", async () => {
    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error("Write error");
    });

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "snooze_email")[2];
    const result = await handler({ id: "999", folder: "INBOX", account: "", subject: "Error test", snoozeUntil: "2026-07-10T09:00:00" });

    expect(result.isError).toBe(true);
  });
});

describe("list_snoozed_emails", () => {
  it("returns 'No snoozed emails' when list is empty", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue("[]");

    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "list_snoozed_emails")[2];
    const result = await handler({});

    expect(result.content[0].text).toContain("No snoozed emails");
    expect(result.isError).toBeUndefined();
  });

  it("shows active snoozes", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
      { id: "123", folder: "INBOX", account: "", subject: "Follow up", snoozeUntil: futureDate, createdAt: new Date().toISOString() },
    ]));

    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "list_snoozed_emails")[2];
    const result = await handler({});

    expect(result.content[0].text).toContain("Active snoozes");
    expect(result.content[0].text).toContain("Follow up");
  });

  it("shows expired snoozes separately", async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
      { id: "456", folder: "INBOX", account: "", subject: "Old reminder", snoozeUntil: pastDate, createdAt: new Date().toISOString() },
    ]));

    const server = { registerTool: vi.fn() };
    registerSnoozeTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls.find((c: any[]) => c[0] === "list_snoozed_emails")[2];
    const result = await handler({});

    expect(result.content[0].text).toContain("Expired snoozes");
    expect(result.content[0].text).toContain("Old reminder");
  });
});
