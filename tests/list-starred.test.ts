import { describe, it, expect, vi } from "vitest";
import { registerStarredTools } from "../src/tools/list-starred";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HimalayaClient } from "../src/himalaya/client.js";

describe("list_starred", () => {
  it("registers the tool", () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    registerStarredTools(server as unknown as McpServer, client);
    expect(server.registerTool).toHaveBeenCalledWith(
      "list_starred",
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("searches with flag Flagged filter", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "searchEnvelopes").mockResolvedValue("[]");
    registerStarredTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    await handler({ folder: undefined, account: undefined });

    expect(client.searchEnvelopes).toHaveBeenCalledWith("flag Flagged", undefined, undefined);
  });

  it("returns helpful message when no starred emails", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "searchEnvelopes").mockResolvedValue("[]");
    registerStarredTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ folder: undefined, account: undefined });

    expect(result.content[0].text).toBe("No starred (flagged) emails.");
  });

  it("formats envelopes when results exist", async () => {
    const envelopes = JSON.stringify([
      {
        id: "100",
        flags: ["Flagged"],
        subject: "Important task",
        from: { name: "Alice", addr: "alice@example.com" },
        to: { name: null, addr: "me@example.com" },
        date: "2026-02-13 10:00",
        has_attachment: false,
      },
    ]);
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "searchEnvelopes").mockResolvedValue(envelopes);
    registerStarredTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ folder: undefined, account: undefined });

    expect(result.content[0].text).toContain("Important task");
    expect(result.content[0].text).toContain("100");
  });

  it("passes folder and account to searchEnvelopes", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "searchEnvelopes").mockResolvedValue("[]");
    registerStarredTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    await handler({ folder: "Sent", account: "work" });

    expect(client.searchEnvelopes).toHaveBeenCalledWith("flag Flagged", "Sent", "work");
  });

  it("handles searchEnvelopes errors", async () => {
    const server = { registerTool: vi.fn() };
    const client = new HimalayaClient({ from: "test@example.com" });
    vi.spyOn(client, "searchEnvelopes").mockRejectedValue(new Error("himalaya error"));
    registerStarredTools(server as unknown as McpServer, client);

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({ folder: undefined, account: undefined });

    expect(result.isError).toBe(true);
  });
});
