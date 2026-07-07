import { describe, it, expect, vi } from "vitest";
import { registerReminderTools } from "../src/tools/reminders";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("../src/adapters/reminders.js", () => ({
  createReminder: vi.fn().mockResolvedValue(undefined),
}));

describe("create_reminder", () => {
  it("registers the tool", () => {
    const server = { registerTool: vi.fn() };
    registerReminderTools(server as unknown as McpServer);
    expect(server.registerTool).toHaveBeenCalledWith(
      "create_reminder",
      expect.objectContaining({
        description: expect.stringContaining("Reminder"),
      }),
      expect.any(Function),
    );
  });

  it("tool description mentions Apple Reminders", () => {
    const server = { registerTool: vi.fn() };
    registerReminderTools(server as unknown as McpServer);
    const call = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0];
    const description = (call[1] as any).description;
    expect(description).toContain("Apple Reminders");
  });

  it("inputSchema accepts title, notes, dueDate, and priority", () => {
    const server = { registerTool: vi.fn() };
    registerReminderTools(server as unknown as McpServer);
    const inputSchema = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][1].inputSchema;
    expect(inputSchema.title).toBeDefined();
    expect(inputSchema.notes).toBeDefined();
    expect(inputSchema.dueDate).toBeDefined();
    expect(inputSchema.priority).toBeDefined();
  });

  it("handler is a function", () => {
    const server = { registerTool: vi.fn() };
    registerReminderTools(server as unknown as McpServer);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(typeof handler).toBe("function");
  });

  it("on macOS, calls createReminder with title and notes", async () => {
    const { createReminder } = await import("../src/adapters/reminders.js");
    vi.mocked(createReminder).mockClear();
    vi.mocked(createReminder).mockResolvedValue(undefined);

    const server = { registerTool: vi.fn() };
    registerReminderTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({
      title: "Buy groceries",
      notes: "Milk, eggs, bread",
      dueDate: undefined,
      priority: undefined,
    });

    expect(createReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Buy groceries",
        notes: "Milk, eggs, bread",
      }),
    );
    expect(result.content[0].text).toContain("Buy groceries");
    expect(result.isError).toBeUndefined();
  });

  it("calls createReminder with dueDate when provided", async () => {
    const { createReminder } = await import("../src/adapters/reminders.js");
    vi.mocked(createReminder).mockClear();

    const server = { registerTool: vi.fn() };
    registerReminderTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    await handler({
      title: "Meeting",
      notes: undefined,
      dueDate: "2026-07-15T14:00:00",
      priority: 1,
    });

    expect(createReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Meeting",
        dueDate: "2026-07-15T14:00:00",
        priority: 1,
      }),
    );
  });

  it("handles reminder creation errors", async () => {
    const { createReminder } = await import("../src/adapters/reminders.js");
    vi.mocked(createReminder).mockRejectedValue(new Error("AppleScript error"));

    const server = { registerTool: vi.fn() };
    registerReminderTools(server as unknown as McpServer);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ title: "Task", notes: undefined, dueDate: undefined, priority: undefined });

    expect(result.isError).toBe(true);
  });
});
