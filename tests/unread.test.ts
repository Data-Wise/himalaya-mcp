import { describe, it, expect, vi } from "vitest";
import { registerUnreadTools } from "../src/tools/unread";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("get_unread_count", () => {
  it("returns the count of unread envelopes", async () => {
    const client = {
      getUnreadCount: vi.fn().mockResolvedValue(3),
      opts: { account: "", folder: "INBOX" },
    };

    const server = {
      registerTool: vi.fn(),
    };

    registerUnreadTools(server as unknown as McpServer, client as any);
    expect(server.registerTool).toHaveBeenCalledWith(
      "get_unread_count",
      expect.any(Object),
      expect.any(Function),
    );

    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({});

    expect(client.getUnreadCount).toHaveBeenCalledWith(undefined, undefined);
    expect(result.content[0].text).toBe("3");
  });

  it("passes folder and account to the client", async () => {
    const client = {
      getUnreadCount: vi.fn().mockResolvedValue(5),
      opts: { account: "", folder: "INBOX" },
    };

    const server = { registerTool: vi.fn() };
    registerUnreadTools(server as unknown as McpServer, client as any);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    await handler({ folder: "Sent", account: "work" });

    expect(client.getUnreadCount).toHaveBeenCalledWith("Sent", "work");
  });

  it("returns 0 when the inbox is fully read", async () => {
    const client = {
      getUnreadCount: vi.fn().mockResolvedValue(0),
      opts: { account: "", folder: "INBOX" },
    };

    const server = { registerTool: vi.fn() };
    registerUnreadTools(server as unknown as McpServer, client as any);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({});

    expect(result.content[0].text).toBe("0");
  });

  it("handles errors via envelopeError", async () => {
    const client = {
      getUnreadCount: vi.fn().mockRejectedValue(new Error("himalaya error")),
      opts: { account: "", folder: "INBOX" },
    };

    const server = { registerTool: vi.fn() };
    registerUnreadTools(server as unknown as McpServer, client as any);
    const handler = (server.registerTool as ReturnType<typeof vi.fn>).mock.calls[0][2];
    const result = await handler({});

    expect(result.isError).toBe(true);
  });
});
